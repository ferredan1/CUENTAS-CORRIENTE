import type { Prisma } from "@prisma/client";
import { serializeMovimiento } from "@/lib/movimiento-json";

/** Incluye relaciones necesarias para la API; `cliente` es opcional según la consulta. */
export type PagoSerializadoPayload = Prisma.PagoGetPayload<{
  include: {
    aplicaciones: { include: { movimiento: true } };
    movimientoPago: true;
  };
}> & {
  cliente?: { id: string; nombre: string } | null;
};

export function serializePago(p: PagoSerializadoPayload) {
  const { importeTotal, aplicaciones, movimientoPago, cliente, ...rest } = p;
  return {
    ...rest,
    importeTotal: Number(importeTotal),
    ...(cliente ? { cliente: { id: cliente.id, nombre: cliente.nombre } } : {}),
    aplicaciones: aplicaciones.map((a) => ({
      ...a,
      importeAplicado: Number(a.importeAplicado),
      movimiento: serializeMovimiento(a.movimiento),
    })),
    movimientoPago: movimientoPago ? serializeMovimiento(movimientoPago) : null,
  };
}
