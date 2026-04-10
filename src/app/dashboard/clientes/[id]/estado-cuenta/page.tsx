import { formatFechaCorta, formatMoneda } from "@/lib/format";
import { getServerUserId } from "@/lib/get-server-user-id";
import { prisma } from "@/lib/prisma";
import { cargarDatosEstadoCuenta } from "@/services/estado-cuenta-data";
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

  const data = await cargarDatosEstadoCuenta(clienteId, {
    desde: sp.desde,
    hasta: sp.hasta,
    obra: sp.obra,
  });
  if (!data) redirect("/dashboard");

  const {
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
    resumenSaldosPorObra,
  } = data;

  const mostrarColObra = obras.length > 0 && !obraId && !sinObra;

  const totalResumenObras = resumenSaldosPorObra.reduce((sum, r) => sum + r.saldo, 0);

  const fmtCant = (m: (typeof movimientosConSaldo)[number]) => {
    const n = Number(m.cantidad);
    if (!Number.isFinite(n)) return "—";
    if (m.tipo === "pago" || m.tipo === "devolucion") return "—";
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(n);
  };

  return (
    <div className="page-shell space-y-4">
      <style>{`
        @media print {
          .page-shell { padding: 0 !important; }
          a[href]:after { content: ""; }
          .estado-cuenta-dashboard-obras a { color: inherit !important; text-decoration: underline; }
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

      <EstadoCuentaControls obras={obras} clienteId={cliente.id} />

      {resumenSaldosPorObra.length > 0 ? (
        <section
          className="estado-cuenta-dashboard-obras overflow-hidden rounded-xl border border-blue-700/30 bg-[#2563eb] text-white shadow-md print:break-inside-avoid print:shadow-none"
          aria-label="Resumen de saldos por obra"
        >
          <h2 className="border-b border-white/20 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white">
            Estado de cuentas
          </h2>
          <div className="grid grid-cols-[1fr_auto] text-sm">
            {resumenSaldosPorObra.map((row) => (
              <div key={row.obraId ?? `sin-${row.orden}`} className="contents">
                <div className="border-b border-white/15 px-4 py-2.5">
                  <span className="tabular-nums text-white/90">{row.orden}.</span>{" "}
                  {row.obraId ? (
                    <Link
                      href={`/dashboard/obras/${row.obraId}`}
                      className="font-semibold uppercase underline decoration-white/70 underline-offset-2 print:text-white"
                    >
                      {row.nombre}
                    </Link>
                  ) : (
                    <span className="font-semibold uppercase underline decoration-white/70 underline-offset-2">
                      {row.nombre}
                    </span>
                  )}
                </div>
                <div className="border-b border-l border-white/15 px-4 py-2.5 text-right font-mono text-sm font-semibold tabular-nums">
                  {formatMoneda(row.saldo)}
                </div>
              </div>
            ))}
            <div className="border-t-2 border-white/35 bg-blue-900/25 px-4 py-2.5 text-sm font-bold uppercase tracking-wide">
              Total
            </div>
            <div className="border-t-2 border-l border-white/35 bg-blue-900/25 px-4 py-2.5 text-right font-mono text-sm font-bold tabular-nums">
              {formatMoneda(totalResumenObras)}
            </div>
          </div>
        </section>
      ) : null}

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
          <p className="text-xs text-slate-500">{movimientosConSaldo.length} movimientos</p>
        </div>

        <div className="table-shell">
          <table className="table-app w-full min-w-[min(100%,44rem)]">
            <thead>
              <tr>
                <th className="w-28">Fecha</th>
                <th className="w-44">Comprobante</th>
                {mostrarColObra ? <th className="w-36">Obra</th> : null}
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
                  {mostrarColObra ? (
                    <td className="text-slate-700 dark:text-slate-200">
                      {m.obra?.id ? (
                        <Link href={`/dashboard/obras/${m.obra.id}`} className="link-app text-sm font-medium">
                          {m.obra.nombre}
                        </Link>
                      ) : (
                        <span className="text-slate-500">Sin obra</span>
                      )}
                    </td>
                  ) : null}
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
                      m.tipo === "pago" || m.tipo === "devolucion"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {m.tipo === "pago" || m.tipo === "devolucion" ? "−" : ""}
                    {formatMoneda(Number(m.total))}
                  </td>
                </tr>
              ))}
              {movimientosConSaldo.length === 0 ? (
                <tr>
                  <td
                    colSpan={mostrarColObra ? 7 : 6}
                    className="py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    Sin movimientos para este rango.
                  </td>
                </tr>
              ) : null}
            </tbody>
            {movimientosConSaldo.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50/60 font-medium dark:border-slate-600 dark:bg-slate-900/50">
                  <td
                    colSpan={mostrarColObra ? 5 : 4}
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
