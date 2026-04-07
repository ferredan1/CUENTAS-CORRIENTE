import { prisma } from "@/lib/prisma";

export type AuditEntidad =
  | "movimiento"
  | "movimiento_proveedor"
  | "cliente"
  | "proveedor"
  | "archivo"
  | "obra";

function jsonStringifyStable(v: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return JSON.stringify(v);
}

export async function auditLogCambio(args: {
  entidad: AuditEntidad;
  entidadId: string;
  cambios: Array<{ campo: string; valorAntes: unknown; valorDespues: unknown }>;
}) {
  if (!args.cambios.length) return;
  try {
    await prisma.logCambio.createMany({
      data: args.cambios.map((c) => ({
        entidad: args.entidad,
        entidadId: args.entidadId,
        campo: c.campo,
        valorAntes: jsonStringifyStable(c.valorAntes),
        valorDespues: jsonStringifyStable(c.valorDespues),
      })),
    });
  } catch {
    // best-effort: nunca romper la operación principal por auditoría
  }
}

export async function auditLogEliminacion(args: {
  entidad: AuditEntidad;
  entidadId: string;
  snapshot: unknown;
}) {
  try {
    await prisma.logEliminacion.create({
      data: {
        entidad: args.entidad,
        entidadId: args.entidadId,
        snapshot: args.snapshot as never,
      },
    });
  } catch {
    // best-effort
  }
}
