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
        className={`table-app w-full max-w-full min-w-[min(100%,42rem)] ${showEstadoCuentaColumn ? "lg:min-w-[720px]" : "lg:min-w-[520px]"}`}
      >
        <thead>
          <tr>
            <th className="min-w-[8rem] max-w-[18rem]">
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:underline"
                onClick={() => onOrderByChange("nombre")}
                title="Ordenar por nombre"
              >
                Cliente <span className="text-slate-400">{iconOrder(orderBy, "nombre")}</span>
              </button>
            </th>
            <th className="w-[7.5rem] shrink-0 text-right">
              <button
                type="button"
                className="inline-flex w-full items-center justify-end gap-1 hover:underline"
                onClick={() => onOrderByChange("saldo")}
                title="Ordenar por saldo"
              >
                Saldo <span className="text-slate-400">{iconOrder(orderBy, "saldo")}</span>
              </button>
            </th>
            <th className="hidden w-[6.5rem] text-right lg:table-cell">Venc. +60d</th>
            <th className="hidden w-[6.5rem] whitespace-nowrap xl:table-cell">Últ. mov.</th>
            {showEstadoCuentaColumn ? (
              <th className="w-[min(13rem,32vw)] max-w-[14rem]">Estado de cuenta</th>
            ) : null}
            <th className="w-[11rem] min-w-[11rem] shrink-0 text-right"> </th>
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
                    ? "bg-rose-50/20 dark:bg-rose-950/10"
                    : c.saldo < 0
                      ? "bg-emerald-50/15 dark:bg-emerald-950/10"
                      : ""
                }`}
              >
                <td className="max-w-[18rem] align-top">
                  <div className="font-medium text-slate-900 dark:text-slate-100">{c.nombre}</div>
                  {[c.cuit, c.telefono].filter(Boolean).length > 0 ? (
                    <div className="text-[0.65rem] text-slate-500 dark:text-slate-400">
                      {[c.cuit, c.telefono].filter(Boolean).join(" · ")}
                    </div>
                  ) : null}
                </td>
                <td className="w-[7.5rem] shrink-0 text-right align-top">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 font-mono text-sm tabular-nums font-semibold ${
                      c.saldo > 0
                        ? "bg-rose-100/80 text-rose-800"
                        : c.saldo < 0
                          ? "bg-emerald-100/80 text-emerald-900"
                          : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {formatMoneda(c.saldo)}
                  </span>
                </td>
                <td className="hidden w-[6.5rem] text-right font-mono text-xs tabular-nums text-slate-700 lg:table-cell">
                  {c.saldoVencido60 > 0 ? formatMoneda(c.saldoVencido60) : "—"}
                </td>
                <td className="hidden w-[6.5rem] whitespace-nowrap text-xs text-slate-600 xl:table-cell">{ult}</td>
                {showEstadoCuentaColumn ? (
                  <td className="max-w-[14rem] align-top">
                    <EstadoGestionCuentaCell
                      clienteId={c.id}
                      estadoCliente={c.estadoGestionCuenta}
                      obras={c.obrasEstado}
                      onGuardado={onEstadoGestionGuardado}
                    />
                  </td>
                ) : null}
                <td className="w-[11rem] min-w-[11rem] shrink-0 align-middle text-right">
                  <div className="inline-flex flex-nowrap items-center justify-end gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
                    <Link
                      href={`/dashboard/clientes/${c.id}/estado-cuenta`}
                      className="btn-secondary inline-flex h-8 shrink-0 items-center px-2 py-0 text-[0.65rem]"
                      prefetch
                    >
                      Cuenta
                    </Link>
                    <Link
                      href={`/dashboard/clientes/${c.id}`}
                      className="btn-tertiary inline-flex h-8 shrink-0 items-center px-2 py-0 text-[0.65rem]"
                      prefetch
                    >
                      Ficha
                    </Link>
                    <BorrarClienteButton
                      clienteId={c.id}
                      nombre={c.nombre}
                      alExito="refrescar"
                      etiqueta="✕"
                      className="btn-secondary inline-flex h-8 shrink-0 border-slate-200 px-2 py-0 text-[0.65rem] text-slate-500 hover:border-rose-300 hover:text-rose-600"
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
