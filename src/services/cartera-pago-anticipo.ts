import type { Prisma } from "@prisma/client";
import { notasIndicanExcluirAnticipoCartera } from "@/domain/cartera-no-anticipo-notas";
import { prisma } from "@/lib/prisma";

export type AnticipoPagoFila = { clienteId: string; obraId: string | null; anticipo: number };

/**
 * Parte de un movimiento `pago` que no está imputada a ventas vía `saldoPendiente` / liquidación.
 * Es lo que debe restarse en `ventas(saldoPendiente) − pagos` para no contar dos veces el cobro
 * que ya bajó el pendiente de la venta o la cerró (`liquidadoPorPagoId` / `AplicacionPago`).
 */
export function anticipoMontoPago(params: {
  total: number;
  esLiquidador: boolean;
  sumaAplicaciones: number;
  /** Cobro conservado tras borrar comprobante: no restar como anticipo en cartera. */
  excluirAnticipoCartera?: boolean;
}): number {
  if (params.excluirAnticipoCartera) return 0;
  const t = params.total;
  if (!(t > 0) || !Number.isFinite(t)) return 0;
  const imputado = params.esLiquidador ? t : Math.min(t, Math.max(0, params.sumaAplicaciones));
  return Math.max(0, t - imputado);
}

export type ImputacionPagoMov = {
  total: number;
  anticipo: number;
  /** Cobro imputado a ventas (liquidación o aplicaciones). */
  imputado: number;
};

async function liquidadorYAplicadoPorPagoIds(pagoIds: string[]): Promise<{
  liquidador: Set<string>;
  aplicadoPorMov: Map<string, number>;
}> {
  if (pagoIds.length === 0) {
    return { liquidador: new Set(), aplicadoPorMov: new Map() };
  }
  const [ventasLiquidadas, pagosConApps] = await Promise.all([
    prisma.movimiento.findMany({
      where: { tipo: "venta", liquidadoPorPagoId: { in: pagoIds } },
      select: { liquidadoPorPagoId: true },
    }),
    prisma.pago.findMany({
      where: { movimientoPagoId: { in: pagoIds } },
      select: {
        movimientoPagoId: true,
        aplicaciones: { select: { importeAplicado: true } },
      },
    }),
  ]);

  const liquidador = new Set(
    ventasLiquidadas.map((v) => v.liquidadoPorPagoId).filter((x): x is string => Boolean(x)),
  );

  const aplicadoPorMov = new Map<string, number>();
  for (const row of pagosConApps) {
    const mid = row.movimientoPagoId;
    if (!mid) continue;
    const s = row.aplicaciones.reduce((acc, a) => acc + Number(a.importeAplicado), 0);
    aplicadoPorMov.set(mid, s);
  }

  return { liquidador, aplicadoPorMov };
}

/** Imputación vs anticipo por id de movimiento `pago` (p. ej. historial en ficha de cliente). */
export async function mapImputacionAnticipoPorPagoIds(
  pagoIds: string[],
): Promise<Map<string, ImputacionPagoMov>> {
  const map = new Map<string, ImputacionPagoMov>();
  if (pagoIds.length === 0) return map;

  const movs = await prisma.movimiento.findMany({
    where: { id: { in: pagoIds }, tipo: "pago" },
    select: { id: true, total: true, notas: true },
  });
  const ids = movs.map((m) => m.id);
  const { liquidador, aplicadoPorMov } = await liquidadorYAplicadoPorPagoIds(ids);

  for (const m of movs) {
    const total = Number(m.total);
    const anticipo = anticipoMontoPago({
      total,
      esLiquidador: liquidador.has(m.id),
      sumaAplicaciones: aplicadoPorMov.get(m.id) ?? 0,
      excluirAnticipoCartera: notasIndicanExcluirAnticipoCartera(m.notas),
    });
    const imputado = Math.max(0, total - anticipo);
    map.set(m.id, { total, anticipo, imputado });
  }
  return map;
}

/**
 * Una fila por movimiento tipo `pago` con el anticipo calculado (sumar por cliente u obra).
 */
export async function cargarAnticiposEnPagos(
  whereExtra: Prisma.MovimientoWhereInput,
): Promise<AnticipoPagoFila[]> {
  const pagos = await prisma.movimiento.findMany({
    where: { tipo: "pago", ...whereExtra },
    select: { id: true, clienteId: true, obraId: true, total: true, notas: true },
  });
  if (pagos.length === 0) return [];

  const pagoIds = pagos.map((p) => p.id);
  const { liquidador, aplicadoPorMov } = await liquidadorYAplicadoPorPagoIds(pagoIds);

  return pagos.map((p) => {
    const total = Number(p.total);
    const anticipo = anticipoMontoPago({
      total,
      esLiquidador: liquidador.has(p.id),
      sumaAplicaciones: aplicadoPorMov.get(p.id) ?? 0,
      excluirAnticipoCartera: notasIndicanExcluirAnticipoCartera(p.notas),
    });
    return { clienteId: p.clienteId, obraId: p.obraId, anticipo };
  });
}

export async function sumAnticipoPagosPorCliente(
  opts?: { clienteIdIn?: string[] },
): Promise<Map<string, number>> {
  const whereExtra =
    opts?.clienteIdIn && opts.clienteIdIn.length > 0 ? { clienteId: { in: opts.clienteIdIn } } : {};
  const filas = await cargarAnticiposEnPagos(whereExtra);
  const map = new Map<string, number>();
  for (const f of filas) {
    map.set(f.clienteId, (map.get(f.clienteId) ?? 0) + f.anticipo);
  }
  return map;
}
