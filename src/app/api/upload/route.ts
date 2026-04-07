import { requireAuth } from "@/lib/auth-api";
import { loadProjectEnv } from "@/lib/env-from-dotenv";
import { checkUploadRateLimit } from "@/lib/upload-rate-limit";
import { resolveUploadBackend } from "@/lib/storage/resolve-upload-backend";
import { saveUploadLocal } from "@/lib/storage/local-upload";
import { supabaseObjectPathClientePdf } from "@/lib/storage/object-paths";
import {
  buildSupabaseStoredFileUrl,
  registrarArchivo,
  tryRemoveStoredFile,
  validarDestinoParaArchivo,
} from "@/services/archivos";
import {
  autoImportarPdfTrasSubida,
  type ResultadoAutoImportPdf,
} from "@/services/auto-import-pdf-upload";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

function looksLikePdf(buffer: Buffer, file: Blob, nombreLower: string): boolean {
  const headerOk = buffer.subarray(0, 5).toString("utf8") === "%PDF-";
  const typeOk = file.type === "application/pdf" || file.type === "";
  const nameOk = nombreLower.endsWith(".pdf");
  return headerOk && typeOk && nameOk;
}

export async function POST(req: NextRequest) {
  loadProjectEnv();

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  if (!checkUploadRateLimit(auth.userId!)) {
    return NextResponse.json(
      { error: "Demasiadas subidas en poco tiempo. Probá de nuevo en unos minutos." },
      { status: 429 },
    );
  }

  const backend = resolveUploadBackend();
  if (backend === "none") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const faltan: string[] = [];
    if (!url) faltan.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!serviceKey) faltan.push("SUPABASE_SERVICE_ROLE_KEY");

    return NextResponse.json(
      {
        error:
          "En producción hace falta Supabase para subir archivos, o definí UPLOAD_STORAGE=local si guardás en disco.",
        faltan,
        pasos: [
          "Supabase → Settings → API: Project URL y service_role en .env",
          "Storage → bucket comprobantes",
          "O en servidor propio: UPLOAD_STORAGE=local",
        ],
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = form.get("file");
  const clienteId = String(form.get("clienteId") ?? "");
  const obraRaw = form.get("obraId");
  const obraId =
    obraRaw === null || obraRaw === "" || obraRaw === "none"
      ? null
      : String(obraRaw);

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId requerido" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "PDF demasiado grande (máx. 12 MB)" }, { status: 400 });
  }

  const nombreOriginal =
    typeof (file as File).name === "string" ? (file as File).name : "documento.pdf";
  const nombre = nombreOriginal.trim() || "documento.pdf";
  const nombreLower = nombre.toLowerCase();

  if (!nombreLower.endsWith(".pdf")) {
    return NextResponse.json({ error: "Solo se aceptan archivos .pdf" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  if (!looksLikePdf(buffer, file, nombreLower)) {
    return NextResponse.json({ error: "El archivo no es un PDF válido" }, { status: 400 });
  }

  const destinoOk = await validarDestinoParaArchivo(clienteId, obraId);
  if (!destinoOk) {
    return NextResponse.json({ error: "Cliente u obra inválidos" }, { status: 400 });
  }

  let storedUrl: string;
  let storage: "local" | "supabase";
  /** Para compensar si falla registrarArchivo (solo Supabase). */
  let supabaseCleanup: { bucket: string; objectPath: string } | null = null;

  if (backend === "local") {
    const { publicPath } = await saveUploadLocal({
      buffer,
      clienteId,
      originalName: nombre,
    });
    storedUrl = new URL(publicPath, req.nextUrl.origin).href;
    storage = "local";
  } else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
    const supabaseService = createClient(url, serviceKey);
    const objectPath = supabaseObjectPathClientePdf(clienteId, nombre);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "comprobantes";

    const { error: upErr } = await supabaseService.storage.from(bucket).upload(objectPath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    supabaseCleanup = { bucket, objectPath };
    storedUrl = buildSupabaseStoredFileUrl(bucket, objectPath);
    storage = "supabase";
  }

  const archivo = await registrarArchivo({
    url: storedUrl,
    nombre,
    clienteId,
    obraId,
  });

  if (!archivo) {
    if (supabaseCleanup) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
      const supabaseService = createClient(url, serviceKey);
      await supabaseService.storage
        .from(supabaseCleanup.bucket)
        .remove([supabaseCleanup.objectPath])
        .catch(() => {});
    } else {
      await tryRemoveStoredFile(storedUrl);
    }
    return NextResponse.json({ error: "No se pudo registrar el archivo" }, { status: 400 });
  }

  const timeoutMs = Math.min(
    Math.max(Number(process.env.PDF_IMPORT_TIMEOUT_MS) || 55_000, 5000),
    120_000,
  );
  const acImport = new AbortController();
  const tImport = setTimeout(() => acImport.abort(), timeoutMs);
  let importacion: ResultadoAutoImportPdf;
  try {
    importacion = await autoImportarPdfTrasSubida(
      buffer,
      clienteId,
      obraId,
      archivo.id,
      { signal: acImport.signal },
    );
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      importacion = {
        comprobantes: [],
        advertencias: [
          `La importación automática superó el tiempo máximo (${Math.round(timeoutMs / 1000)} s). El PDF quedó guardado; podés importar o cargar ítems a mano.`,
        ],
      };
    } else {
      throw e;
    }
  } finally {
    clearTimeout(tImport);
  }

  const verEn = new URL(`/api/archivos/${archivo.id}/file`, req.nextUrl.origin).href;

  return NextResponse.json(
    { archivo, storage, importacion, verEn },
    { status: 201 },
  );
}
