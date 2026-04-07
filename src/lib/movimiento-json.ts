import type { Movimiento, Obra, Prisma } from "@prisma/client";

export type MovimientoConObra = Movimiento & {
  obra: Pick<Obra, "id" | "nombre"> | null;
};

function decimalToNumber(v: Prisma.Decimal | number): number {
  if (typeof v === "number") return v;
  return v.toNumber();
}

/** Respuestas JSON: Prisma `Decimal` → número (evita serializar como string/objeto raro). */
export function serializeMovimiento<M extends Movimiento | MovimientoConObra>(m: M) {
  const { precioUnitario, total, saldoPendiente, ...rest } = m;
  const sp =
    saldoPendiente !== undefined && saldoPendiente !== null
      ? decimalToNumber(saldoPendiente as Prisma.Decimal | number)
      : 0;
  return {
    ...rest,
    precioUnitario: decimalToNumber(precioUnitario),
    total: decimalToNumber(total),
    saldoPendiente: sp,
  };
}

export function serializeMovimientos(list: MovimientoConObra[]) {
  return list.map(serializeMovimiento);
}
