/** PDFs de cliente: rutas por entidad en Storage o bajo `/uploads/clientes/…` en disco. */
import { anexarMarcadorNoAnticipoCartera } from "@/domain/cartera-no-anticipo-notas";
import { loadProjectEnv } from "@/lib/env-from-dotenv";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { unlink } from "node:fs/promises";
import { join } from "node:path";

/** Prefijo en `Archivo.url` cuando el objeto está en Supabase sin URL pública (se sirve vía firma). */
export const SUPABASE_STORAGE_URL_PREFIX = "supabase-storage:";

export function buildSupabaseStoredFileUrl(bucket: string, objectPath: string): string {
  return `${SUPABASE_STORAGE_URL_PREFIX}${bucket}:${objectPath}`;
}

/** Valida cliente y obra antes de persistir o subir bytes. */
export async function validarDestinoParaArchivo(
  clienteId: string,
  obraId: string | null | undefined,
): Promise<boolean> {
  const c = await prisma.cliente.findFirst({
    where: { id: clienteId },
    select: { id: true },
  });
  if (!c) return false;

  if (obraId) {
    const o = await prisma.obra.findFirst({
      where: { id: obraId, clienteId },
      select: { id: true },
    });
    if (!o) return false;
  }
  return true;
}

export async function registrarArchivo(data: {
  url: string;
  nombre?: string | null;
  clienteId: string;
  obraId?: string | null;
  comprobante?: string | null;
}) {
  const c = await prisma.cliente.findFirst({
    where: { id: data.clienteId },
    select: { id: true },
  });
  if (!c) return null;

  if (data.obraId) {
    const o = await prisma.obra.findFirst({
      where: { id: data.obraId, clienteId: data.clienteId },
      select: { id: true },
    });
    if (!o) return null;
  }

  return prisma.archivo.create({
    data: {
      url: data.url,
      nombre: data.nombre ?? null,
      comprobante: data.comprobante?.trim() || null,
      clienteId: data.clienteId,
      obraId: data.obraId ?? null,
    },
  });
}

export async function archivoDelCliente(
  archivoId: string,
  clienteId: string,
): Promise<{ id: string } | null> {
  return prisma.archivo.findFirst({
    where: { id: archivoId, clienteId },
    select: { id: true },
  });
}

export async function listarArchivosPorCliente(clienteId: string) {
  const c = await prisma.cliente.findFirst({
    where: { id: clienteId },
    select: { id: true },
  });
  if (!c) return null;

  return prisma.archivo.findMany({
    where: { clienteId },
    orderBy: { createdAt: "desc" },
    include: { obra: { select: { nombre: true } } },
  });
}

/** Quita el archivo de disco local o del bucket Supabase (después de borrar el registro en BD si aplica). */
export async function tryRemoveStoredFile(url: string): Promise<void> {
  loadProjectEnv();

  if (url.startsWith(SUPABASE_STORAGE_URL_PREFIX)) {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!baseUrl || !serviceKey) return;

    const rest = url.slice(SUPABASE_STORAGE_URL_PREFIX.length);
    const colon = rest.indexOf(":");
    if (colon < 0) return;
    const bucket = rest.slice(0, colon);
    const objectPath = rest.slice(colon + 1);
    if (!bucket || !objectPath) return;

    const supabaseService = createClient(baseUrl, serviceKey);
    await supabaseService.storage.from(bucket).remove([objectPath]).catch((err) => {
      console.error("[storage] No se pudo borrar objeto Supabase:", objectPath, err);
    });
    return;
  }

  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.startsWith("/") ? url : `/${url}`;
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "uploads") {
    const abs = join(process.cwd(), "public", ...parts);
    await unlink(abs).catch(() => {
      /* ya borrado o no existe */
    });
    return;
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "comprobantes";
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!baseUrl || !serviceKey) return;

  const pubMarker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(pubMarker);
  if (idx < 0) return;

  const objectPath = decodeURIComponent(url.slice(idx + pubMarker.length).split("?")[0] ?? "");
  if (!objectPath) return;

  const supabaseService = createClient(baseUrl, serviceKey);
  await supabaseService.storage.from(bucket).remove([objectPath]).catch((err) => {
    console.error("[storage] No se pudo borrar objeto (URL pública):", objectPath, err);
  });
}

/**
 * Pagos «de liquidación» de comprobante (marcar pagado): `liquidadoPorPagoId` en ventas del PDF.
 * Si borramos esas ventas, el pago quedaría como anticipo total → saldo a favor.
 * Les añadimos el marcador en `notas` para que el saldo sea correcto y el cobro siga en el historial.
 */
async function idsPagosSoloLigadosAVentasDeArchivo(
  tx: Prisma.TransactionClient,
  archivoId: string,
): Promise<string[]> {
  const ventasDelArchivo = await tx.movimiento.findMany({
    where: { archivoId, tipo: "venta" },
    select: { id: true, liquidadoPorPagoId: true },
  });
  const ventaIds = ventasDelArchivo.map((v) => v.id);
  if (ventaIds.length === 0) return [];

  const pagoCandidatos = [
    ...new Set(
      ventasDelArchivo.map((v) => v.liquidadoPorPagoId).filter((x): x is string => Boolean(x)),
    ),
  ];
  const out: string[] = [];
  for (const pagoId of pagoCandidatos) {
    const otras = await tx.movimiento.count({
      where: {
        tipo: "venta",
        liquidadoPorPagoId: pagoId,
        id: { notIn: ventaIds },
      },
    });
    if (otras === 0) out.push(pagoId);
  }
  return out;
}

export async function eliminarArchivo(archivoId: string): Promise<boolean> {
  const archivo = await prisma.archivo.findFirst({
    where: { id: archivoId },
  });
  if (!archivo) return false;

  await prisma.$transaction(async (tx) => {
    const pagoIds = await idsPagosSoloLigadosAVentasDeArchivo(tx, archivoId);
    if (pagoIds.length > 0) {
      const pagos = await tx.movimiento.findMany({
        where: { id: { in: pagoIds }, tipo: "pago" },
        select: { id: true, notas: true },
      });
      for (const p of pagos) {
        await tx.movimiento.update({
          where: { id: p.id },
          data: { notas: anexarMarcadorNoAnticipoCartera(p.notas) },
        });
      }
    }
    await tx.movimiento.deleteMany({ where: { archivoId } });
    await tx.archivo.delete({ where: { id: archivoId } });
  });

  await tryRemoveStoredFile(archivo.url);
  return true;
}
