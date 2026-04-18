/**
 * Saldo de cartera por cliente (misma lógica que el panel: ventas con `saldoPendiente`,
 * pagos vía anticipo, devoluciones/ajustes con `total`).
 */

import { conMovimientoOtroParaSaldoCartera } from "@/domain/cartera-movimiento-where";
import { saldoDesdeTotalesPorTipo } from "@/domain/saldos";
import { prisma } from "@/lib/prisma";
import { cargarAnticiposEnPagos } from "@/services/cartera-pago-anticipo";

export type FiltroObraCartera =
  | { alcance: "todas" }
  | { alcance: "obra"; obraId: string }
  | { alcance: "sin_obra" };

function obraWhereDesdeFiltro(f: FiltroObraCartera): { obraId: string } | { obraId: null } | Record<string, never> {
  if (f.alcance === "sin_obra") return { obraId: null };
  if (f.alcance === "obra") return { obraId: f.obraId };
  return {};
}

/**
 * Saldo total a cobrar (igual que «Saldo total» en la ficha del cliente) para el alcance de obra indicado.
 */
export async function calcularSaldoCarteraCliente(
  clienteId: string,
  filtroObra: FiltroObraCartera,
): Promise<number> {
  const { saldo } = await calcularTotalesCarteraCliente(clienteId, filtroObra);
  return saldo;
}

type TotalesCartera = {
  saldo: number;
  saldoPorTipo: Record<string, number>;
};

async function calcularTotalesCarteraCliente(
  clienteId: string,
  filtroObra: FiltroObraCartera,
): Promise<TotalesCartera> {
  const ow = obraWhereDesdeFiltro(filtroObra);

  const [ventaObraAgg, otroObraAgg, anticipoPagosFilas] = await Promise.all([
    prisma.movimiento.groupBy({
      by: ["obraId"],
      where: { clienteId, tipo: "venta", ...ow },
      _sum: { saldoPendiente: true },
    }),
    prisma.movimiento.groupBy({
      by: ["obraId", "tipo"],
      where: conMovimientoOtroParaSaldoCartera({ clienteId, ...ow }),
      _sum: { total: true },
    }),
    cargarAnticiposEnPagos({ clienteId, ...ow }),
  ]);

  const saldoPorTipo: Record<string, number> = {};

  for (const g of ventaObraAgg) {
    saldoPorTipo.venta = (saldoPorTipo.venta ?? 0) + Number(g._sum.saldoPendiente ?? 0);
  }
  for (const g of otroObraAgg) {
    const sum = Number(g._sum.total ?? 0);
    saldoPorTipo[g.tipo] = (saldoPorTipo[g.tipo] ?? 0) + sum;
  }
  for (const ap of anticipoPagosFilas) {
    saldoPorTipo.pago = (saldoPorTipo.pago ?? 0) + ap.anticipo;
  }

  return { saldo: saldoDesdeTotalesPorTipo(saldoPorTipo), saldoPorTipo };
}

export type ResumenObraCartera = { orden: number; obraId: string | null; nombre: string; saldo: number };

/**
 * Saldo global del cliente + desglose por obra (mismo criterio que el panel en el recuadro azul).
 */
export async function calcularSaldoCarteraYResumenPorObra(clienteId: string): Promise<{
  saldo: number;
  resumenPorObra: ResumenObraCartera[];
  saldoPorTipo: Record<string, number>;
  saldoSinObraPorTipo: Record<string, number>;
}> {
  const obras = await prisma.obra.findMany({
    where: { clienteId },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const acum = new Map<string | null, Record<string, number>>();

  const [ventaObraAgg, otroObraAgg, anticipoPagosFilas] = await Promise.all([
    prisma.movimiento.groupBy({
      by: ["obraId"],
      where: { clienteId, tipo: "venta" },
      _sum: { saldoPendiente: true },
    }),
    prisma.movimiento.groupBy({
      by: ["obraId", "tipo"],
      where: conMovimientoOtroParaSaldoCartera({ clienteId }),
      _sum: { total: true },
    }),
    cargarAnticiposEnPagos({ clienteId }),
  ]);

  for (const g of ventaObraAgg) {
    const oid = g.obraId;
    const sum = Number(g._sum.saldoPendiente ?? 0);
    const prev = acum.get(oid) ?? {};
    prev.venta = (prev.venta ?? 0) + sum;
    acum.set(oid, prev);
  }
  for (const g of otroObraAgg) {
    const oid = g.obraId;
    const t = g.tipo;
    const sum = Number(g._sum.total ?? 0);
    const prev = acum.get(oid) ?? {};
    prev[t] = (prev[t] ?? 0) + sum;
    acum.set(oid, prev);
  }
  for (const ap of anticipoPagosFilas) {
    const oid = ap.obraId;
    const sum = ap.anticipo;
    const prev = acum.get(oid) ?? {};
    prev.pago = (prev.pago ?? 0) + sum;
    acum.set(oid, prev);
  }

  const saldoPorTipo: Record<string, number> = {};
  for (const [, rec] of acum) {
    for (const [tipo, val] of Object.entries(rec)) {
      saldoPorTipo[tipo] = (saldoPorTipo[tipo] ?? 0) + val;
    }
  }
  const saldo = saldoDesdeTotalesPorTipo(saldoPorTipo);
  const saldoSinObraPorTipo = acum.get(null) ?? {};

  const resumenPorObra: ResumenObraCartera[] = [];
  let orden = 0;
  for (const o of obras) {
    orden += 1;
    resumenPorObra.push({
      orden,
      obraId: o.id,
      nombre: o.nombre,
      saldo: saldoDesdeTotalesPorTipo(acum.get(o.id) ?? {}),
    });
  }
  if (acum.has(null)) {
    orden += 1;
    resumenPorObra.push({
      orden,
      obraId: null,
      nombre: "Sin obra",
      saldo: saldoDesdeTotalesPorTipo(acum.get(null) ?? {}),
    });
  }

  return { saldo, resumenPorObra, saldoPorTipo, saldoSinObraPorTipo };
}
