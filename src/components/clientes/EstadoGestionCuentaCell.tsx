"use client";

import type { EstadoGestionCuenta } from "@prisma/client";
import { ETIQUETA_ESTADO_GESTION, ESTADOS_GESTION_CUENTA } from "@/types/estado-gestion-cuenta";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ChangeEvent } from "react";

const selectCls =
  "max-w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[0.7rem] font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

export function EstadoGestionCuentaCell({
  clienteId,
  estadoCliente,
  obras,
  onGuardado,
}: {
  clienteId: string;
  estadoCliente: EstadoGestionCuenta;
  obras: { id: string; nombre: string; estadoGestionCuenta: EstadoGestionCuenta }[];
  /** Recarga datos de tabla en el padre (p. ej. fetch a `/api/clientes`). */
  onGuardado?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const patchCliente = useCallback(
    async (v: EstadoGestionCuenta) => {
      setErr(null);
      const res = await fetch(`/api/clientes/${encodeURIComponent(clienteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estadoGestionCuenta: v }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      await onGuardado?.();
      refresh();
    },
    [clienteId, refresh, onGuardado],
  );

  const patchObra = useCallback(
    async (obraId: string, v: EstadoGestionCuenta) => {
      setErr(null);
      const res = await fetch(`/api/obras/${encodeURIComponent(obraId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estadoGestionCuenta: v }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      await onGuardado?.();
      refresh();
    },
    [refresh, onGuardado],
  );

  const onChangeCliente = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as EstadoGestionCuenta;
    void patchCliente(v).catch((ex) => setErr(ex instanceof Error ? ex.message : "Error"));
  };

  const onChangeObra = (obraId: string) => (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as EstadoGestionCuenta;
    void patchObra(obraId, v).catch((ex) => setErr(ex instanceof Error ? ex.message : "Error"));
  };

  if (obras.length === 0) {
    return (
      <div className="min-w-0 max-w-[13rem]">
        <select
          className={selectCls}
          value={estadoCliente}
          disabled={pending}
          onChange={onChangeCliente}
          aria-label="Estado de cuenta del cliente"
        >
          {ESTADOS_GESTION_CUENTA.map((k) => (
            <option key={k} value={k}>
              {ETIQUETA_ESTADO_GESTION[k]}
            </option>
          ))}
        </select>
        {err ? <p className="mt-1 text-[0.65rem] text-rose-600 dark:text-rose-400">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className="max-w-[min(20rem,100%)]">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
        {obras.map((o) => (
          <div key={o.id} className="flex w-[min(100%,9.5rem)] min-w-[7rem] flex-col gap-0.5">
            <span
              className="truncate text-[0.6rem] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
              title={o.nombre}
            >
              {o.nombre}
            </span>
            <select
              className={selectCls}
              value={o.estadoGestionCuenta}
              disabled={pending}
              onChange={onChangeObra(o.id)}
              aria-label={`Estado de cuenta · ${o.nombre}`}
            >
              {ESTADOS_GESTION_CUENTA.map((k) => (
                <option key={k} value={k}>
                  {ETIQUETA_ESTADO_GESTION[k]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {err ? <p className="mt-1 text-[0.65rem] text-rose-600 dark:text-rose-400">{err}</p> : null}
    </div>
  );
}
