"use client";

import { BorrarClienteButton } from "@/components/BorrarClienteButton";
import { EstadoGestionCuentaCell } from "@/components/clientes/EstadoGestionCuentaCell";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import type { OrdenClientesTabla } from "@/types/clientes-tabla";
import type { EstadoGestionCuenta } from "@prisma/client";
import type { EstadoCobranza } from "@/components/ClienteCobranzaBadge";
import Link from "next/link";
import { useRef } from "react";

export type ClienteTablaRow = {
  id: string;
  nombre: string;
  tipo: string;
  cuit: string | null;
  telefono: string | null;
  saldo: number;
  deudaMas90?: number;
  estadoCobranza?: EstadoCobranza;
  estadoGestionCuenta: EstadoGestionCuenta;
  obrasEstado: { id: string; nombre: string; estadoGestionCuenta: EstadoGestionCuenta }[];
  /** Conservado por compatibilidad con la API; no se muestra en la tabla. */
  diasSinPagar?: number | null;
  saldoVencido60: number;
  ultimoMovimientoFecha: string | Date | null;
  obrasCount: number;
};

type Props = {
  rows: ClienteTablaRow[];
  orderBy: OrdenClientesTabla;
  onOrderByChange: (o: OrdenClientesTabla) => void;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  /** Tras guardar estado (cliente u obra), recarga filas desde la API (el estado local no sigue a `router.refresh()`). */
  onEstadoGestionGuardado?: () => void | Promise<void>;
  /** En la vista previa del dashboard se oculta; en Clientes completo se muestra. */
  showEstadoCuentaColumn?: boolean;
};

function iconOrder(active: OrdenClientesTabla, col: OrdenClientesTabla): string {
  if (active !== col) return "↕";
  return "↓";
}

export function ClientesTable({
  rows,
  orderBy,
  onOrderByChange,
  sentinelRef,
  loadingMore,
  onEstadoGestionGuardado,
  showEstadoCuentaColumn = true,
}: Props) {
  const tableWrapRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={tableWrapRef} className="table-shell touch-pan-x">
      <table
        className={`table-app table-fixed w-full max-w-full min-w-[min(100%,36rem)] ${showEstadoCuentaColumn ? "lg:min-w-[56rem]" : "lg:min-w-[480px]"}`}
      >
        <colgroup>
          <col className="w-[26%] sm:w-[24%]" />
          <col className="w-[7.5rem]" />
          <col className="hidden w-[5.5rem] md:table-column" />
          {showEstadoCuentaColumn ? <col className="w-[22%]" /> : null}
          <col className="min-w-[10rem] w-auto" />
        </colgroup>
        <thead>
          <tr>
            <th className="max-w-0 p-2 sm:p-3">
              <button
                type="button"
                className="inline-flex max-w-full items-center gap-1 truncate text-left hover:underline"
                onClick={() => onOrderByChange("nombre")}
                title="Ordenar por nombre"
              >
                Cliente <span className="shrink-0 text-slate-500 dark:text-slate-400">{iconOrder(orderBy, "nombre")}</span>
              </button>
            </th>
            <th className="w-[7.5rem] shrink-0 p-2 text-right sm:p-3">
              <button
                type="button"
                className="inline-flex w-full items-center justify-end gap-1 hover:underline"
                onClick={() => onOrderByChange("saldo")}
                title="Ordenar por saldo"
              >
                Saldo <span className="text-slate-500 dark:text-slate-400">{iconOrder(orderBy, "saldo")}</span>
              </button>
            </th>
            <th className="hidden w-[5.5rem] whitespace-nowrap p-2 md:table-cell sm:p-3">Últ. mov.</th>
            {showEstadoCuentaColumn ? (
              <th className="p-2 sm:p-3">Estado de cuenta</th>
            ) : null}
            <th className="p-2 text-right sm:p-3"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const ult =
              c.ultimoMovimientoFecha != null
                ? formatFechaCorta(
                    typeof c.ultimoMovimientoFecha === "string"
                      ? c.ultimoMovimientoFecha
                      : c.ultimoMovimientoFecha.toISOString(),
                  )
                : "—";
            return (
              <tr
                key={c.id}
                className={`group border-b border-slate-100 transition-colors ${
                  c.saldo > 0
                    ? "bg-rose-50/60 dark:bg-rose-950/30"
                    : c.saldo < 0
                      ? "bg-emerald-50/45 dark:bg-emerald-950/25"
                      : "bg-white dark:bg-slate-950"
                }`}
              >
                <td className="max-w-0 align-top p-2 sm:p-3">
                  <div className="truncate font-medium text-slate-900 dark:text-slate-100" title={c.nombre}>
                    {c.nombre}
                  </div>
                  {[c.cuit, c.telefono].filter(Boolean).length > 0 ? (
                    <div className="truncate text-[0.65rem] text-slate-600 dark:text-slate-300" title={[c.cuit, c.telefono].filter(Boolean).join(" · ")}>
                      {[c.cuit, c.telefono].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </td>
                <td className="w-[7.5rem] shrink-0 p-2 text-right align-top sm:p-3">
                  <span
                    className={`inline-flex max-w-full items-center rounded-md px-2 py-0.5 font-mono text-sm tabular-nums font-semibold ${
                      c.saldo > 0
                        ? "bg-rose-100/90 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
                        : c.saldo < 0
                          ? "bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <span className="truncate">{formatMoneda(c.saldo)}</span>
                  </span>
                  {c.saldo < 0 ? (
                    <div className="mt-1 text-[0.65rem] font-medium leading-tight text-emerald-700 dark:text-emerald-300">
                      A favor
                    </div>
                  ) : null}
                </td>
                <td className="hidden w-[5.5rem] whitespace-nowrap p-2 text-xs text-slate-700 dark:text-slate-300 md:table-cell sm:p-3">
                  {ult}
                </td>
                {showEstadoCuentaColumn ? (
                  <td className="max-w-0 align-top p-2 sm:p-3">
                    <EstadoGestionCuentaCell
                      clienteId={c.id}
                      estadoCliente={c.estadoGestionCuenta}
                      obras={c.obrasEstado}
                      onGuardado={onEstadoGestionGuardado}
                    />
                  </td>
                ) : null}
                <td className="align-top p-2 text-right sm:p-3">
                  <div className="flex flex-wrap items-center justify-end gap-1 sm:flex-nowrap">
                    <Link
                      href={`/dashboard/clientes/${c.id}/estado-cuenta`}
                      className="btn-secondary inline-flex min-h-9 shrink-0 items-center px-2.5 py-1.5 text-[0.65rem] sm:h-8 sm:py-0"
                      prefetch
                    >
                      Cuenta
                    </Link>
                    <Link
                      href={`/dashboard/clientes/${c.id}`}
                      className="btn-tertiary inline-flex min-h-9 shrink-0 items-center px-2.5 py-1.5 text-[0.65rem] sm:h-8 sm:py-0"
                      prefetch
                    >
                      Ficha
                    </Link>
                    <BorrarClienteButton
                      clienteId={c.id}
                      nombre={c.nombre}
                      alExito="refrescar"
                      etiqueta="✕"
                      className="btn-secondary inline-flex min-h-9 shrink-0 border-slate-200 px-2.5 py-1.5 text-[0.65rem] text-slate-600 hover:border-rose-300 hover:text-rose-600 dark:text-slate-400 sm:h-8 sm:py-0"
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
      {loadingMore ? (
        <p className="py-2 text-center text-xs text-slate-500">Cargando más…</p>
      ) : null}
    </div>
  );
}
