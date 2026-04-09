import { getServerUserId } from "@/lib/get-server-user-id";
import { prisma } from "@/lib/prisma";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
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

  const movimientos = await prisma.movimiento.findMany({
    where: {
      tipo: "pago",
      ...(desde || hasta
        ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
        : {}),
    },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    include: { cliente: { select: { id: true, nombre: true } } },
  });

  const rows = movimientos.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    cliente: m.cliente.nombre,
    descripcion: m.descripcion,
    medioPago: m.medioPago ?? "sin_medio",
    total: Number(m.total ?? 0),
  }));

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
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Descripción</th>
              <th>Medio de pago</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-slate-600">{formatFechaCorta(r.fecha)}</td>
                <td className="font-medium">{r.cliente}</td>
                <td className="text-slate-700">{r.descripcion}</td>
                <td className="capitalize text-slate-700">{r.medioPago.replace(/_/g, " ")}</td>
                <td className="text-right font-mono tabular-nums font-semibold text-slate-800">
                  {formatMoneda(r.total)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200">
              <td colSpan={4} className="font-semibold text-slate-700">Total</td>
              <td className="text-right font-mono tabular-nums font-bold text-slate-900">
                {formatMoneda(totalDia)}
              </td>
            </tr>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
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

