/**
 * Saldo = SUM(venta + ajuste) − SUM(pago) − SUM(devolución).
 * `ajuste` suma como venta (total puede ser negativo para corregir).
 */
export function saldoDesdeTotalesPorTipo(totales: Record<string, number>): number {
  const ventas = (totales["venta"] ?? 0) + (totales["ajuste"] ?? 0);
  const pagos = totales["pago"] ?? 0;
  const devoluciones = totales["devolucion"] ?? 0;
  return ventas - pagos - devoluciones;
}

/**
 * Saldo efectivo = saldo que ya cobró efectivamente (excluye pagos en cheque pendientes de vencimiento).
 *
 * Regla: un pago con medioPago="cheque" cuenta como efectivo solo si `chequeVencimiento` es hoy o anterior.
 * Si no tiene vencimiento, se considera pendiente.
 */
export function saldoEfectivoConCheques(params: {
  totalesPorTipo: Record<string, number>;
  totalPagosChequePendientes: number;
}): number {
  return saldoDesdeTotalesPorTipo(params.totalesPorTipo) + params.totalPagosChequePendientes;
}

export function acumularPorTipo(filas: { tipo: string; total: number }[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of filas) {
    acc[r.tipo] = (acc[r.tipo] ?? 0) + r.total;
  }
  return acc;
}

export function totalesPendientesDesdeFilas(
  filas: {
    tipo: string;
    total: number;
    liquidadoAt?: string | null;
    /** Si viene (p. ej. desde API), las ventas usan este monto impago en lugar de `total`. */
    saldoPendiente?: number | null;
  }[],
): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const r of filas) {
    let monto: number;
    if (r.tipo === "venta") {
      if (r.saldoPendiente != null && Number.isFinite(Number(r.saldoPendiente))) {
        monto = Number(r.saldoPendiente);
      } else {
        monto = r.liquidadoAt ? 0 : r.total;
      }
    } else {
      monto = r.total;
    }
    acc[r.tipo] = (acc[r.tipo] ?? 0) + monto;
  }
  return acc;
}
