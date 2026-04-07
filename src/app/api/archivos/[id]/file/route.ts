import { requireAuth } from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";
import { SUPABASE_STORAGE_URL_PREFIX } from "@/services/archivos";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

/**
 * Sirve o redirige al PDF del comprobante solo si el archivo pertenece a un cliente del usuario.
 * Objetos nuevos en Supabase usan URL interna (`supabase-storage:`) y se exponen con URL firmada.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const archivo = await prisma.archivo.findFirst({
    where: { id },
  });
  if (!archivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const url = archivo.url;
  const nombre = archivo.nombre ?? "comprobante.pdf";

  if (url.startsWith(SUPABASE_STORAGE_URL_PREFIX)) {
    const rest = url.slice(SUPABASE_STORAGE_URL_PREFIX.length);
    const colon = rest.indexOf(":");
    if (colon < 0) {
      return NextResponse.json({ error: "URL de almacenamiento inválida" }, { status: 500 });
    }
    const bucket = rest.slice(0, colon);
    const objectPath = rest.slice(colon + 1);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!baseUrl || !serviceKey) {
      return NextResponse.json({ error: "Storage no configurado" }, { status: 503 });
    }
    const supabaseService = createClient(baseUrl, serviceKey);
    const { data, error } = await supabaseService.storage
      .from(bucket)
      .createSignedUrl(objectPath, 600);
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message ?? "No se pudo generar enlace" }, { status: 502 });
    }
    return NextResponse.redirect(data.signedUrl);
  }

  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const parts = pathname.split("/").filter(Boolean);
    if (parts[0] === "uploads") {
      const abs = join(process.cwd(), "public", ...parts);
      const buf = await readFile(abs);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(nombre)}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
  } catch {
    /* URL relativa u otro formato */
  }

  if (url.startsWith("/uploads/")) {
    const parts = url.split("/").filter(Boolean);
    const abs = join(process.cwd(), "public", ...parts);
    const buf = await readFile(abs);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(nombre)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (baseUrl && serviceKey) {
      try {
        const u = new URL(url);
        const base = new URL(baseUrl);
        if (u.hostname === base.hostname) {
          const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
          if (m) {
            const bucket = m[1]!;
            const objectPath = decodeURIComponent(m[2]!);
            const supabaseService = createClient(baseUrl, serviceKey);
            const { data, error } = await supabaseService.storage.from(bucket).createSignedUrl(objectPath, 600);
            if (!error && data?.signedUrl) {
              return NextResponse.redirect(data.signedUrl);
            }
          }
        }
      } catch {
        /* seguir al redirect directo */
      }
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.json({ error: "Formato de archivo no soportado" }, { status: 500 });
}
