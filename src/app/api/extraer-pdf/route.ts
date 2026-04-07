import { requireAuth } from "@/lib/auth-api";
import { loadProjectEnv } from "@/lib/env-from-dotenv";
import { extraerTextoDePdf } from "@/lib/pdf/extract-text";
import {
  contarComprobantesConNumero,
  extraerItemsDelTextoComprobante,
  extraerSugerenciaComprobante,
} from "@/services/extraer-lineas-comprobante";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(req: NextRequest) {
  loadProjectEnv();

  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `PDF demasiado grande (máx. ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let texto: string;
  try {
    texto = await extraerTextoDePdf(buffer);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al leer PDF";
    return NextResponse.json(
      {
        error:
          "No se pudo extraer texto del PDF. Si es un escaneo (solo imagen), hace falta OCR u otra herramienta.",
        detalle: msg,
      },
      { status: 422 },
    );
  }

  const items = extraerItemsDelTextoComprobante(texto);
  const sugerenciaComprobante =
    extraerSugerenciaComprobante(texto) ?? `PDF-${Date.now()}`;

  const advertencias: string[] = [];
  if (!texto.trim()) {
    advertencias.push("El PDF no devolvió texto (¿documento escaneado sin capa de texto?).");
  } else if (items.length === 0) {
    advertencias.push(
      "No se detectaron líneas con el formato esperado. Revise la vista previa del texto o cargue ítems a mano / con otro comprobante.",
    );
  }
  const nComp = contarComprobantesConNumero(texto);
  if (nComp > 1) {
    advertencias.push(
      `Este PDF incluye ${nComp} comprobantes: con «Subir archivo» se importan todos, cada uno con su número y fecha. (La vista previa manual usa un solo comprobante para toda la grilla; para varios, conviene solo subir el PDF.)`,
    );
  }

  return NextResponse.json({
    items,
    sugerenciaComprobante,
    textoMuestra: texto.slice(0, 4000),
    caracteresTexto: texto.length,
    advertencias,
  });
}
