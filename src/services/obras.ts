import type { EstadoGestionCuenta } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { esEstadoGestionCuenta } from "@/types/estado-gestion-cuenta";
import { tryRemoveStoredFile } from "@/services/archivos";
import { saldoDesdeTotalesPorTipo } from "@/domain/saldos";

async function asegurarCliente(clienteId: string) {
  const c = await prisma.cliente.findFirst({
    where: { id: clienteId },
    select: { id: true },
  });
  return c !== null;
}

export async function listarObras(clienteId: string) {
  const ok = await asegurarCliente(clienteId);
  if (!ok) return null;

  return prisma.obra.findMany({
    where: { clienteId },
    orderBy: { nombre: "asc" },
  });
}

export async function actualizarObra(
  obraId: string,
  input: { estadoGestionCuenta?: EstadoGestionCuenta },
) {
  const existe = await prisma.obra.findFirst({
    where: { id: obraId },
    select: { id: true },
  });
  if (!existe) return null;

  if (input.estadoGestionCuenta !== undefined && !esEstadoGestionCuenta(input.estadoGestionCuenta)) {
    throw new Error("Estado de gestión inválido");
  }

  if (input.estadoGestionCuenta === undefined) {
    return prisma.obra.findFirst({ where: { id: obraId } });
  }

  /** SQL directo: mismo motivo que en `listarClientesParaTabla` (client Prisma desincronizado con el schema). */
  await prisma.$executeRaw`
    UPDATE "Obra"
    SET "estadoGestionCuenta" = ${input.estadoGestionCuenta}::"EstadoGestionCuenta"
    WHERE id = ${obraId}
  `;

  const rows = await prisma.$queryRaw<
    {
      id: string;
      nombre: string;
      clienteId: string;
      estadoGestionCuenta: string;
      createdAt: Date;
      updatedAt: Date;
    }[]
  >`
    SELECT id, nombre, "clienteId", "estadoGestionCuenta", "createdAt", "updatedAt"
    FROM "Obra"
    WHERE id = ${obraId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    estadoGestionCuenta: row.estadoGestionCuenta as EstadoGestionCuenta,
  };
}

export async function crearObra(clienteId: string, nombre: string) {
  const ok = await asegurarCliente(clienteId);
  if (!ok) return null;
  if (!nombre.trim()) throw new Error("Nombre de obra requerido");

  return prisma.obra.create({
    data: { clienteId, nombre: nombre.trim() },
  });
}

export async function obtenerObraConCliente(obraId: string) {
  const obra = await prisma.obra.findFirst({
    where: { id: obraId },
    include: {
      cliente: true,
      archivos: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!obra) return null;

  const movs = await prisma.movimiento.findMany({
    where: { obraId },
    select: { tipo: true, total: true },
  });

  const porTipo: Record<string, number> = {};
  for (const m of movs) {
    porTipo[m.tipo] = (porTipo[m.tipo] ?? 0) + Number(m.total);
  }

  return {
    ...obra,
    saldoObra: saldoDesdeTotalesPorTipo(porTipo),
    clienteNombre: obra.cliente.nombre,
    movimientosEnObra: movs.length,
    comprobantesEnObra: obra.archivos.length,
  };
}

/**
 * Elimina la obra y, en cascada, todos los movimientos con esa obra y los comprobantes PDF
 * asociados a la obra (incluye ventas ligadas a esos PDF). Limpia archivos en disco/Storage.
 *
 * No es atómico con el storage: si el proceso se interrumpe tras el borrado en BD y antes de
 * borrar en Storage, pueden quedar objetos huérfanos (un job de limpieza periódico mitiga el riesgo).
 */
export async function eliminarObra(obraId: string): Promise<boolean> {
  const obra = await prisma.obra.findFirst({
    where: { id: obraId },
    select: { id: true },
  });
  if (!obra) return false;

  const archivosDeObra = await prisma.archivo.findMany({
    where: { obraId },
    select: { url: true },
  });

  await prisma.obra.deleteMany({
    where: { id: obraId },
  });

  for (const a of archivosDeObra) {
    await tryRemoveStoredFile(a.url);
  }

  return true;
}
