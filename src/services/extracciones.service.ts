import { prisma } from "@/lib/prisma";

export const PARSER_VERSION_AUTO_IMPORT = "auto-import-v2";

export type EstadoExtraccion = "pendiente" | "ok" | "error";

async function siguienteIntento(archivoId: string): Promise<number> {
  const last = await prisma.extraccionArchivo.findFirst({
    where: { archivoId },
    orderBy: { intento: "desc" },
    select: { intento: true },
  });
  return (last?.intento ?? 0) + 1;
}

export async function crearExtraccionArchivo(params: {
  archivoId: string;
  estado: EstadoExtraccion;
  textoExtraido?: string | null;
  jsonExtraido?: unknown;
  confianza?: number | null;
  errores?: string | null;
  versionParser?: string | null;
}) {
  const intento = await siguienteIntento(params.archivoId);
  return prisma.extraccionArchivo.create({
    data: {
      archivoId: params.archivoId,
      intento,
      estado: params.estado,
      textoExtraido: params.textoExtraido ?? null,
      confianza: params.confianza ?? null,
      errores: params.errores ?? null,
      versionParser: params.versionParser ?? null,
      ...(params.jsonExtraido !== undefined ? { jsonExtraido: params.jsonExtraido as object } : {}),
    },
  });
}

export async function agregarErroresExtraccion(extraccionId: string, mensaje: string) {
  const row = await prisma.extraccionArchivo.findUnique({
    where: { id: extraccionId },
    select: { errores: true },
  });
  const prev = row?.errores?.trim() || "";
  const next = prev ? `${prev}\n${mensaje}` : mensaje;
  await prisma.extraccionArchivo.update({
    where: { id: extraccionId },
    data: { errores: next, estado: "error" },
  });
}

export async function marcarExtraccionImportada(extraccionId: string, primerMovimientoId: string) {
  await prisma.extraccionArchivo.update({
    where: { id: extraccionId },
    data: {
      estado: "ok",
      importadoComoMovId: primerMovimientoId,
    },
  });
}
