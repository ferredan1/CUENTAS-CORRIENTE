"use client";

import { formatFechaCorta } from "@/lib/format";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type RowC = {
  movimientoId: string;
  comprobante: string | null;
  tipo: string;
  fecha: string;
  clienteId: string;
  clienteNombre: string;
};

type RowP = {
  movimientoId: string;
  comprobante: string | null;
  tipo: string;
  fecha: string;
  proveedorId: string;
  proveedorNombre: string;
};

export function BuscarPageClient() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<RowC[]>([]);
  const [proveedores, setProveedores] = useState<RowP[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const wants = (e.metaKey || e.ctrlKey) && key === "k";
      if (!wants) return;
      e.preventDefault();
      const el = document.getElementById("buscar-q") as HTMLInputElement | null;
      el?.focus();
      el?.select?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const run = useCallback(async () => {
    if (debounced.length < 2) {
      setClientes([]);
      setProveedores([]);
      setErr(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/busqueda?q=${encodeURIComponent(debounced)}`);
      const data = (await res.json()) as {
        clientes?: RowC[];
        proveedores?: RowP[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Error");
      setClientes(data.clientes ?? []);
      setProveedores(data.proveedores ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setClientes([]);
      setProveedores([]);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="page-shell max-w-3xl space-y-6">
      <header>
        <h1 className="page-title">Buscar por comprobante</h1>
        <p className="page-subtitle-quiet text-slate-500">
          Coincidencias en movimientos de clientes y de proveedores (mínimo 2 caracteres).
        </p>
      </header>

      <div>
        <label className="label-field" htmlFor="buscar-q">
          Comprobante
        </label>
        <input
          id="buscar-q"
          className="input-app mt-1 w-full max-w-xl"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ej. A-0001-01234567"
          autoComplete="off"
        />
      </div>

      {err ? (
        <p className="alert-error" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Buscando…</p> : null}

      {!loading && debounced.length >= 2 && clientes.length === 0 && proveedores.length === 0 ? (
        <p className="text-sm text-slate-600">Sin resultados.</p>
      ) : null}

      {clientes.length > 0 ? (
        <section className="card-compact space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Clientes</h2>
          <ul className="divide-y divide-slate-100">
            {clientes.map((r) => (
              <li key={r.movimientoId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <Link
                    href={`/dashboard/clientes/${r.clienteId}`}
                    className="font-medium text-emerald-800 hover:underline"
                  >
                    {r.clienteNombre}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    · {r.comprobante ?? "—"} · <span className="capitalize">{r.tipo}</span> ·{" "}
                    {formatFechaCorta(r.fecha)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {proveedores.length > 0 ? (
        <section className="card-compact space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Proveedores</h2>
          <ul className="divide-y divide-slate-100">
            {proveedores.map((r) => (
              <li key={r.movimientoId} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <div>
                  <Link
                    href={`/dashboard/proveedores/${r.proveedorId}`}
                    className="font-medium text-amber-900 hover:underline"
                  >
                    {r.proveedorNombre}
                  </Link>
                  <span className="text-slate-500">
                    {" "}
                    · {r.comprobante ?? "—"} · <span className="capitalize">{r.tipo}</span> ·{" "}
                    {formatFechaCorta(r.fecha)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
