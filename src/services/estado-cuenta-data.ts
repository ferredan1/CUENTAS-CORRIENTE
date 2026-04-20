import { saldoDesdeTotalesPorTipo } from "@/domain/saldos";
import { parseQueryDayEnd, parseQueryDayStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { listarMovimientos } from "@/services/movimientos";
import {
  calcularSaldoCarteraCliente,
  calcularSaldoCarteraYResumenPorObra,
  type FiltroObraCartera,
} from "@/services/saldo-cartera-cliente";

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
  /** Suma de movimientos `pago` + `devolucion` (para totales combinados). */
  totalPagosPeriodo: number;
  totalPagosSoloPeriodo: number;
  totalDevolucionesPeriodo: number;
  /** Suma de filas `devolucion` con `devolucionVentaOrigenId` (el bajado ya está en `saldoPendiente` de la venta). */
  totalDevolucionesVinculadasVentaPeriodo: number;
  /** Suma de devoluciones manuales / sin vínculo a venta (sí restan en cartera como fila `devolucion`). */
  totalDevolucionesManualPeriodo: number;
  etiquetaFiltroObra: string;
  /** Saldo por obra (misma lógica que el panel: ventas con `saldoPendiente`, pagos con anticipo, etc.). Solo si el alcance es «todas las obras». */
  resumenSaldosPorObra: { orden: number; obraId: string | null; nombre: string; saldo: number }[];
  /** Saldo total a cobrar según cartera, alineado con «Saldo total» en la ficha del cliente para el mismo alcance de obra. */
  saldoCarteraAlCierre: number;
  /** Suma de `resumenSaldosPorObra[].saldo` (debe coincidir con `saldoCarteraAlCierre` salvo redondeo). */
  saldoSumaResumenPorObra: number;
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

  const filtroCartera: FiltroObraCartera = sinObra
    ? { alcance: "sin_obra" }
    : obraId
      ? { alcance: "obra", obraId }
      : { alcance: "todas" };

  const saldoCarteraAlCierre = await calcularSaldoCarteraCliente(clienteId, filtroCartera);

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
                  /** Las devoluciones sobre venta ya están en el `total` histórico de la venta vía `saldoPendiente` en cartera; no sumar la fila duplicada. */
                  NOT: { tipo: "devolucion", devolucionVentaOrigenId: { not: null } },
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
  const totalPagosSoloPeriodo = movimientos
    .filter((m) => m.tipo === "pago")
    .reduce((s, m) => s + Number(m.total), 0);
  const movsDevolucion = movimientos.filter((m) => m.tipo === "devolucion");
  const totalDevolucionesPeriodo = movsDevolucion.reduce((s, m) => s + Number(m.total), 0);
  const totalDevolucionesVinculadasVentaPeriodo = movsDevolucion
    .filter((m) => m.devolucionVentaOrigenId != null)
    .reduce((s, m) => s + Number(m.total), 0);
  const totalDevolucionesManualPeriodo = movsDevolucion
    .filter((m) => m.devolucionVentaOrigenId == null)
    .reduce((s, m) => s + Number(m.total), 0);
  const totalPagosPeriodo = totalPagosSoloPeriodo + totalDevolucionesPeriodo;

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
    const { resumenPorObra } = await calcularSaldoCarteraYResumenPorObra(clienteId);
    resumenSaldosPorObra = resumenPorObra;
  }

  const saldoSumaResumenPorObra = resumenSaldosPorObra.reduce((s, r) => s + r.saldo, 0);
  if (resumenSaldosPorObra.length > 0 && Math.abs(saldoSumaResumenPorObra - saldoCarteraAlCierre) > 0.02) {
    console.warn(
      `[estado-cuenta] Suma resumen por obra (${saldoSumaResumenPorObra}) ≠ saldo cartera (${saldoCarteraAlCierre}) cliente=${clienteId}`,
    );
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
    totalPagosSoloPeriodo,
    totalDevolucionesPeriodo,
    totalDevolucionesVinculadasVentaPeriodo,
    totalDevolucionesManualPeriodo,
    etiquetaFiltroObra,
    resumenSaldosPorObra,
    saldoCarteraAlCierre,
    saldoSumaResumenPorObra,
  };
}
