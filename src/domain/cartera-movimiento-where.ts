import type { Prisma } from "@prisma/client";

/**
 * Filtro para movimientos que suman con `_sum.total` en cartera (ajustes, etc.).
 * Las devoluciones sobre una venta (`devolucionVentaOrigenId` set) no entran: el bajado ya está en `venta.saldoPendiente`.
 * Las devoluciones manuales (`devolucionVentaOrigenId` null) sí restan en el saldo.
 */
const movimientoOtroConTotalParaSaldoCartera: Prisma.MovimientoWhereInput = {
  OR: [
    { tipo: { notIn: ["venta", "pago", "devolucion"] } },
    { tipo: "devolucion", devolucionVentaOrigenId: null },
  ],
};

export function conMovimientoOtroParaSaldoCartera(
  base: Prisma.MovimientoWhereInput,
): Prisma.MovimientoWhereInput {
  return { AND: [base, movimientoOtroConTotalParaSaldoCartera] };
}
