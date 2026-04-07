"use client";

import {
  FiltrosProveedores,
  type FiltroProveedoresRapido,
} from "@/components/proveedores/FiltrosProveedores";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import Link from "next/link";
import { useMemo, useState } from "react";

type Prov = {
  id: string;
  nombre: string;
  saldo: number;
  ultimoMovimientoFecha?: string | null;
  vencimientoReferencia?: string | null;
};

function filtrar(rows: Prov[], filtro: FiltroProveedoresRapido): Prov[] {
  switch (filtro) {
    case "con_deuda":
      return rows.filter((p) => p.saldo > 0);
    case "al_dia":
      return rows.filter((p) => p.saldo === 0);
    case "a_favor":
      return rows.filter((p) => p.saldo < 0);
    default:
      return rows;
  }
}

function celdaFecha(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  return formatFechaCorta(iso);
}

export function DashboardProveedoresPreview({ proveedores }: { proveedores: Prov[] }) {
  const [filtro, setFiltro] = useState<FiltroProveedoresRapido>("todos");
  const list = useMemo(() => filtrar(proveedores, filtro), [proveedores, filtro]);

  return (
    <section
      aria-labelledby="dash-prov-heading"
      className="flex w-full min-w-0 flex-col self-start rounded-xl border border-slate-200/90 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div>
          <h2 id="dash-prov-heading" className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Proveedores
          </h2>
          <p className="mt-0.5 text-[0.7rem] text-slate-500">Cuentas con saldo a pagar</p>
        </div>
        <Link
          href="/dashboard/proveedores"
          className="btn-secondary h-8 shrink-0 px-3 py-0 text-xs font-medium"
        >
          Ver todos →
        </Link>
      </div>
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Filtro rápido</p>
        <FiltrosProveedores value={filtro} onChange={setFiltro} />
      </div>
      <div className="flex min-h-0 flex-col overflow-x-auto px-2 py-3 sm:px-4">
        {list.length === 0 ? (
          <p className="px-2 py-1 text-center text-sm text-slate-500 dark:text-slate-400">
            {proveedores.length === 0
              ? "Sin deuda con proveedores"
              : "Ningún proveedor coincide con este filtro"}
          </p>
        ) : (
          <table className="table-app w-full min-w-[28rem] text-sm">
            <thead>
              <tr>
                <th className="text-left">Proveedor</th>
                <th className="w-[6.5rem] text-right">Saldo</th>
                <th className="hidden w-[5.5rem] sm:table-cell">Venc.</th>
                <th className="hidden w-[5.5rem] md:table-cell">Últ. mov.</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr
                  key={p.id}
                  className={
                    p.saldo > 0
                      ? "bg-rose-50/40 dark:bg-rose-950/15"
                      : p.saldo < 0
                        ? "bg-emerald-50/25 dark:bg-emerald-950/10"
                        : undefined
                  }
                >
                  <td className="max-w-[10rem] truncate font-medium">
                    <Link
                      href={`/dashboard/proveedores/${p.id}`}
                      className="text-slate-800 hover:text-emerald-800 hover:underline dark:text-slate-100"
                    >
                      {p.nombre}
                    </Link>
                  </td>
                  <td className="text-right font-mono text-xs font-bold tabular-nums text-rose-800 dark:text-rose-300">
                    {formatMoneda(p.saldo)}
                  </td>
                  <td className="hidden whitespace-nowrap text-xs tabular-nums text-slate-600 sm:table-cell">
                    {celdaFecha(p.vencimientoReferencia ?? null)}
                  </td>
                  <td className="hidden whitespace-nowrap text-xs tabular-nums text-slate-600 md:table-cell">
                    {celdaFecha(p.ultimoMovimientoFecha ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
