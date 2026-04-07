import { ClienteCobranzaBadge } from "@/components/ClienteCobranzaBadge";
import { formatMoneda } from "@/lib/format";
import type { ClienteVistaPreviaPanel } from "@/services/clientes";
import Link from "next/link";

function celdaDias(dias: number | null, saldo: number) {
  if (!(saldo > 0)) {
    return <span className="text-slate-400">—</span>;
  }
  if (dias == null) {
    return <span className="text-slate-400">—</span>;
  }
  const cls =
    dias >= 60 ? "font-semibold text-rose-700" : dias >= 30 ? "font-medium text-amber-700" : "text-slate-700";
  return (
    <span className={`font-mono tabular-nums ${cls}`}>
      {dias} {dias === 1 ? "día" : "días"}
    </span>
  );
}

export function PanelVistaPreviaClientes({ rows }: { rows: ClienteVistaPreviaPanel[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="card-compact space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Estado de clientes</h2>
          <p className="mt-0.5 text-[0.7rem] text-slate-400">
            Vista previa: nombre, saldo y cobranza. CUIT y teléfono están en la ficha de cada cliente.
          </p>
        </div>
        <Link href="/dashboard/clientes" className="shrink-0 text-xs font-medium text-emerald-700 hover:underline">
          Ver todos →
        </Link>
      </div>
      <div className="table-shell -mx-1 max-w-full sm:mx-0">
        <table className="table-app text-sm">
          <thead>
            <tr>
              <th className="min-w-0 max-w-[12rem]">Cliente</th>
              <th className="w-[6.5rem] text-right">Saldo</th>
              <th className="w-[6.5rem]">Días s/ pagar</th>
              <th className="min-w-[7rem]">Cobranza</th>
              <th className="w-16 text-center">Obras</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={
                  r.saldo > 0
                    ? "bg-rose-50/20 dark:bg-rose-950/10"
                    : r.saldo < 0
                      ? "bg-emerald-50/15 dark:bg-emerald-950/10"
                      : undefined
                }
              >
                <td className="max-w-[10rem] sm:max-w-none">
                  <Link
                    href={`/dashboard/clientes/${r.id}`}
                    className="font-medium text-slate-900 hover:text-emerald-800 hover:underline dark:text-slate-100"
                  >
                    {r.nombre}
                  </Link>
                </td>
                <td className="text-right">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 font-mono text-xs tabular-nums font-semibold ${
                      r.saldo > 0
                        ? "bg-rose-100/80 text-rose-800"
                        : r.saldo < 0
                          ? "bg-emerald-100/80 text-emerald-900"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {formatMoneda(r.saldo)}
                  </span>
                </td>
                <td className="text-sm">{celdaDias(r.diasSinPagar, r.saldo)}</td>
                <td>
                  <ClienteCobranzaBadge estado={r.estadoCobranza} saldo={r.saldo} deudaMas90={r.deudaMas90} />
                </td>
                <td className="text-center tabular-nums text-slate-600">
                  {r.obrasCount === 0 ? "—" : `${r.obrasCount}`}
                </td>
                <td>
                  <Link href={`/dashboard/clientes/${r.id}`} className="btn-secondary inline-flex px-2 py-1 text-xs">
                    Ficha
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
