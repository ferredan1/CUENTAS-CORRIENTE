import { saldoDesdeTotalesPorTipo } from "@/domain/saldos";
import { armarMensajeEstadoCuentaWhatsapp } from "@/lib/estado-cuenta-whatsapp-message";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import { parseQueryDayEnd, parseQueryDayStart } from "@/lib/dates";
import { getServerUserId } from "@/lib/get-server-user-id";
import { whatsappUrlWithBody } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";
import { listarMovimientos } from "@/services/movimientos";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EstadoCuentaControls } from "./EstadoCuentaControls";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; obra?: string }>;
};

export default async function EstadoCuentaPage({ params, searchParams }: Props) {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");
  const { id: clienteId } = await params;
  const sp = await searchParams;

  const desde = parseQueryDayStart(sp.desde ?? null);
  const hasta = parseQueryDayEnd(sp.hasta ?? null);
  const obraFiltro = sp.obra?.trim() ?? "";
  const sinObra = obraFiltro === "__sin_obra__";
  const obraId = !sinObra && obraFiltro ? obraFiltro : undefined;

  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId },
    select: { id: true, nombre: true, cuit: true, email: true, telefono: true, createdAt: true, updatedAt: true },
  });
  if (!cliente) redirect("/dashboard");

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
  const movimientosConSaldo = movimientos.map((m) => {
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

  const fmtCant = (m: (typeof movimientosConSaldo)[number]) => {
    const n = Number(m.cantidad);
    if (!Number.isFinite(n)) return "—";
    if (m.tipo === "pago" || m.tipo === "devolucion") return "—";
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(n);
  };

  let etiquetaFiltroObra: string;
  if (sinObra) {
    etiquetaFiltroObra = "Solo movimientos sin obra asignada";
  } else if (obraId) {
    const nom = obras.find((o) => o.id === obraId)?.nombre;
    etiquetaFiltroObra = `Obra: ${nom ?? "—"}`;
  } else {
    etiquetaFiltroObra = "Todas las obras (cada ítem indica obra si corresponde)";
  }

  const incluirObraEnLineas = !sinObra && !obraId;

  const mensajeWhatsapp = armarMensajeEstadoCuentaWhatsapp({
    nombreCliente: cliente.nombre,
    desde: desde ?? null,
    hasta: hasta ?? null,
    etiquetaFiltroObra,
    saldoAnterior,
    movimientos: movimientosConSaldo.map((m) => ({
      fecha: m.fecha instanceof Date ? m.fecha : new Date(m.fecha),
      tipo: m.tipo,
      comprobante: m.comprobante,
      descripcion: m.descripcion,
      cantidad: Number(m.cantidad),
      precioUnitario: Number(m.precioUnitario),
      total: Number(m.total),
      saldo: m.saldo,
      obraNombre: m.obra?.nombre ?? null,
    })),
    totalVentas: totalVentasPeriodo,
    totalPagos: totalPagosPeriodo,
    incluirObraEnLineas,
  });

  const whatsappHref = whatsappUrlWithBody(cliente.telefono, mensajeWhatsapp);

  return (
    <div className="page-shell space-y-4">
      <style>{`
        @media print {
          .page-shell { padding: 0 !important; }
          a[href]:after { content: ""; }
        }
      `}</style>

      <nav className="breadcrumb-muted print:hidden" aria-label="Migas de pan">
        <Link href={`/dashboard/clientes/${cliente.id}`}>Cliente</Link>
        <span aria-hidden>/</span>
        <span className="text-slate-600">Estado de cuenta</span>
      </nav>

      <header className="flex flex-col gap-2 border-b border-slate-200/80 pb-4">
        <h1 className="page-title">Estado de cuenta</h1>
        <p className="text-sm text-slate-600">
          <span className="font-medium text-slate-900">{cliente.nombre}</span>
          {cliente.cuit ? <span className="text-slate-400"> · CUIT {cliente.cuit}</span> : null}
        </p>
        <p className="text-xs text-slate-500">
          {desde ? `Desde ${formatFechaCorta(desde)}` : "Desde el inicio"}
          {hasta ? ` · Hasta ${formatFechaCorta(hasta)}` : ""}
        </p>
      </header>

      <EstadoCuentaControls obras={obras} whatsappHref={whatsappHref} />

      <section className="card-compact space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Saldo anterior al período:{" "}
            <span
              className={`font-mono font-semibold tabular-nums ${
                saldoAnterior > 0 ? "text-rose-700" : saldoAnterior < 0 ? "text-emerald-700" : "text-slate-700"
              }`}
            >
              {formatMoneda(saldoAnterior)}
            </span>
          </p>
          {obraId || sinObra ? (
            <p className="text-xs text-slate-500">
              Obra:{" "}
              <span className="font-medium text-slate-700">
                {sinObra ? "Sin obra" : obras.find((o) => o.id === obraId)?.nombre ?? "—"}
              </span>
            </p>
          ) : null}
          <p className="text-xs text-slate-500">{movimientos.length} movimientos</p>
        </div>

        <div className="table-shell">
          <table className="table-app w-full min-w-[min(100%,44rem)]">
            <thead>
              <tr>
                <th className="w-28">Fecha</th>
                <th className="w-44">Comprobante</th>
                <th>Descripción</th>
                <th className="w-20 text-right">Cant.</th>
                <th className="w-28 text-right">Precio unitario</th>
                <th className="w-28 text-right">Precio final</th>
              </tr>
            </thead>
            <tbody>
              {movimientosConSaldo.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-slate-600 dark:text-slate-300">{formatFechaCorta(m.fecha)}</td>
                  <td className="font-mono text-xs tabular-nums text-slate-700 dark:text-slate-200">{m.comprobante ?? "—"}</td>
                  <td className="text-slate-800 dark:text-slate-100">
                    <span className="capitalize text-slate-500 dark:text-slate-400">[{m.tipo}]</span>{" "}
                    {m.descripcion}
                  </td>
                  <td className="text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">{fmtCant(m)}</td>
                  <td className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                    {m.tipo === "pago" || m.tipo === "devolucion" ? "—" : formatMoneda(Number(m.precioUnitario))}
                  </td>
                  <td
                    className={`text-right font-mono tabular-nums ${
                      m.tipo === "pago" || m.tipo === "devolucion" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {m.tipo === "pago" || m.tipo === "devolucion" ? "−" : ""}
                    {formatMoneda(Number(m.total))}
                  </td>
                </tr>
              ))}
              {movimientosConSaldo.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Sin movimientos para este rango.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {movimientos.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50/60 font-medium dark:border-slate-600 dark:bg-slate-900/50">
                  <td
                    colSpan={4}
                    className="py-3 pr-4 text-right text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400"
                  >
                    Totales del período
                  </td>
                  <td className="py-3 text-right font-mono text-sm text-slate-500">—</td>
                  <td className="py-3 text-right font-mono text-sm">
                    <div className="text-slate-700">Ventas: {formatMoneda(totalVentasPeriodo)}</div>
                    <div className="text-emerald-700">Pagos: −{formatMoneda(totalPagosPeriodo)}</div>
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  );
}

