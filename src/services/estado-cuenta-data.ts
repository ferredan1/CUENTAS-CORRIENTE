import { saldoDesdeTotalesPorTipo } from "@/domain/saldos";
import { parseQueryDayEnd, parseQueryDayStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { listarMovimientos } from "@/services/movimientos";

export type MovimientoEstadoCuentaRow = Awaited<ReturnType<typeof listarMovimientos>>[number] & { saldo: number };

export type EstadoCuentaCargado = {
  cliente: {
    id: string;
    nombre: string;
    cuit: string | null;
    email: string | null;
    telefono: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  obras: { id: string; nombre: string }[];
  desde: Date | undefined;
  hasta: Date | undefined;
  sinObra: boolean;
  obraId: string | undefined;
  saldoAnterior: number;
  movimientosConSaldo: MovimientoEstadoCuentaRow[];
  totalVentasPeriodo: number;
  totalPagosPeriodo: number;
  etiquetaFiltroObra: string;
  /** Saldo acumulado por obra hasta «hasta» (si no hay hasta, todo el historial). Solo si el alcance es «todas las obras». */
  resumenSaldosPorObra: { orden: number; obraId: string | null; nombre: string; saldo: number }[];
};

/**
 * Misma lógica que la página de estado de cuenta (filtros, saldos, movimientos).
 */
export async function cargarDatosEstadoCuenta(
  clienteId: string,
  searchParams: { desde?: string; hasta?: string; obra?: string },
): Promise<EstadoCuentaCargado | null> {
  const desde = parseQueryDayStart(searchParams.desde ?? null);
  const hasta = parseQueryDayEnd(searchParams.hasta ?? null);
  const obraFiltro = searchParams.obra?.trim() ?? "";
  const sinObra = obraFiltro === "__sin_obra__";
  const obraId = !sinObra && obraFiltro ? obraFiltro : undefined;

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId },
    select: { id: true, nombre: true, cuit: true, email: true, telefono: true, createdAt: true, updatedAt: true },
  });
  if (!cliente) return null;

  const obras = await prisma.obra.findMany({
    where: { clienteId },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  const saldoAnterior =
    desde != null
      ? saldoDesdeTotalesPorTipo(
          Object.fromEntries(
            (
              await prisma.movimiento.groupBy({
                by: ["tipo"],
                where: {
                  clienteId,
                  ...(sinObra ? { obraId: null } : obraId ? { obraId } : {}),
                  fecha: { lt: desde },
                },
                _sum: { total: true },
              })
            ).map((g) => [g.tipo, Number(g._sum?.total ?? 0)]),
          ),
        )
      : 0;

  const movimientos = await listarMovimientos({
    clienteId,
    ...(sinObra ? { sinObra: true } : obraId ? { obraId } : {}),
    desde: desde ?? undefined,
    hasta: hasta ?? undefined,
    limit: 5000,
  });

  const acumPorTipo: Record<string, number> = {};
  const movimientosConSaldo: MovimientoEstadoCuentaRow[] = movimientos.map((m) => {
    acumPorTipo[m.tipo] = (acumPorTipo[m.tipo] ?? 0) + Number(m.total);
    const saldo = saldoAnterior + saldoDesdeTotalesPorTipo(acumPorTipo);
    return { ...m, saldo };
  });

  const totalVentasPeriodo = movimientos
    .filter((m) => m.tipo === "venta" || m.tipo === "ajuste")
    .reduce((s, m) => s + Number(m.total), 0);
  const totalPagosPeriodo = movimientos
    .filter((m) => m.tipo === "pago" || m.tipo === "devolucion")
    .reduce((s, m) => s + Number(m.total), 0);

  let etiquetaFiltroObra: string;
  if (sinObra) {
    etiquetaFiltroObra = "Solo movimientos sin obra asignada";
  } else if (obraId) {
    const nom = obras.find((o) => o.id === obraId)?.nombre;
    etiquetaFiltroObra = `Obra: ${nom ?? "—"}`;
  } else {
    etiquetaFiltroObra = "Todas las obras";
  }

  let resumenSaldosPorObra: EstadoCuentaCargado["resumenSaldosPorObra"] = [];
  if (!sinObra && !obraId && obras.length > 0) {
    const whereResumen: Prisma.MovimientoWhereInput = { clienteId };
    if (hasta != null) {
      whereResumen.fecha = { lte: hasta };
    }
    const grupos = await prisma.movimiento.groupBy({
      by: ["obraId", "tipo"],
      where: whereResumen,
      _sum: { total: true },
    });
    const acum = new Map<string | null, Record<string, number>>();
    for (const g of grupos) {
      const oid = g.obraId;
      const t = g.tipo;
      const sum = Number(g._sum.total ?? 0);
      const prev = acum.get(oid) ?? {};
      prev[t] = (prev[t] ?? 0) + sum;
      acum.set(oid, prev);
    }
    let orden = 0;
    for (const o of obras) {
      orden += 1;
      resumenSaldosPorObra.push({
        orden,
        obraId: o.id,
        nombre: o.nombre,
        saldo: saldoDesdeTotalesPorTipo(acum.get(o.id) ?? {}),
      });
    }
    if (acum.has(null)) {
      orden += 1;
      resumenSaldosPorObra.push({
        orden,
        obraId: null,
        nombre: "Sin obra",
        saldo: saldoDesdeTotalesPorTipo(acum.get(null) ?? {}),
      });
    }
  }

  return {
    cliente,
    obras,
    desde,
    hasta,
    sinObra,
    obraId,
    saldoAnterior,
    movimientosConSaldo,
    totalVentasPeriodo,
    totalPagosPeriodo,
    etiquetaFiltroObra,
    resumenSaldosPorObra,
  };
}
