import { getServerUserId } from "@/lib/get-server-user-id";
import { prisma } from "@/lib/prisma";
import { formatMoneda } from "@/lib/format";
import { parseQueryDayEnd, parseQueryDayStart } from "@/lib/dates";
import { redirect } from "next/navigation";

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");
  const sp = await searchParams;

  const desde = parseQueryDayStart(sp.desde ?? null);
  const hasta = parseQueryDayEnd(sp.hasta ?? null);

  const grouped = await prisma.movimiento.groupBy({
    by: ["medioPago"],
    where: {
      tipo: "pago",
      ...(desde || hasta
        ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
        : {}),
    },
    _sum: { total: true },
  });

  const rows = grouped
    .map((g) => ({
      medioPago: g.medioPago ?? "sin_medio",
      total: Number(g._sum?.total ?? 0),
    }))
    .sort((a, b) => b.total - a.total);

  const totalDia = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="page-shell space-y-6">
      <header className="border-b border-slate-200/80 pb-6">
        <h1 className="page-title">Caja</h1>
        <p className="page-subtitle-quiet">
          Resumen de cobros imputados por medio de pago.
          {desde || hasta
            ? ` Período: ${desde ? desde.toLocaleDateString("es-AR") : "inicio"} a ${
                hasta ? hasta.toLocaleDateString("es-AR") : "hoy"
              }.`
            : " Mostrando histórico completo."}
        </p>
      </header>

      <form className="print:hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem]">
            <span className="label-field">Desde</span>
            <input name="desde" type="date" defaultValue={sp.desde ?? ""} className="input-app" />
          </label>
          <label className="min-w-[10rem]">
            <span className="label-field">Hasta</span>
            <input name="hasta" type="date" defaultValue={sp.hasta ?? ""} className="input-app" />
          </label>
          <button type="submit" className="btn-secondary">
            Aplicar
          </button>
          <a href="/dashboard/caja" className="btn-tertiary">
            Limpiar
          </a>
        </div>
      </form>

      <div className="table-shell">
        <table className="table-app w-full">
          <thead>
            <tr>
              <th>Medio de pago</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.medioPago}>
                <td className="capitalize text-slate-700">{r.medioPago.replace(/_/g, " ")}</td>
                <td className="text-right font-mono tabular-nums font-semibold text-slate-800">
                  {formatMoneda(r.total)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200">
              <td className="font-semibold text-slate-700">Total</td>
              <td className="text-right font-mono tabular-nums font-bold text-slate-900">
                {formatMoneda(totalDia)}
              </td>
            </tr>
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="py-10 text-center text-sm text-slate-500">
                  No hay cobros imputados para el período seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

