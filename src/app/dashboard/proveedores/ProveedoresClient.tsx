"use client";

import {
  FiltrosProveedores,
  type FiltroProveedoresRapido,
} from "@/components/proveedores/FiltrosProveedores";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import { BorrarProveedorButton } from "@/components/BorrarProveedorButton";
import { IconSearch } from "@/components/UiIcons";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type ProveedorRow = {
  id: string;
  nombre: string;
  razonSocial: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  condicionIva: string | null;
  notas: string | null;
  saldo: number;
  ultimoMovimientoFecha?: string | null;
  vencimientoReferencia?: string | null;
};

function celdaFecha(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  return formatFechaCorta(iso);
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function filtrarPorSaldo(rows: ProveedorRow[], filtro: FiltroProveedoresRapido): ProveedorRow[] {
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

export function ProveedoresClient({
  initialQ,
  initialProveedores,
}: {
  initialQ: string;
  initialProveedores: ProveedorRow[];
}) {
  const [q, setQ] = useState(initialQ);
  const debouncedQ = useDebouncedValue(q, 300);
  const [proveedores, setProveedores] = useState<ProveedorRow[]>(initialProveedores);
  const [filtroRapido, setFiltroRapido] = useState<FiltroProveedoresRapido>("todos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ by: "nombre" | "saldo"; dir: "asc" | "desc" }>({
    by: "nombre",
    dir: "asc",
  });
  const abortRef = useRef<AbortController | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [mostrarDatosExtra, setMostrarDatosExtra] = useState(false);
  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [condicionIva, setCondicionIva] = useState("");
  const [creando, setCreando] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);

  const hayBusqueda = useMemo(() => Boolean(q.trim()), [q]);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());

    void (async () => {
      try {
        const res = await fetch(`/api/proveedores?${params.toString()}`, {
          credentials: "same-origin",
          signal: ac.signal,
        });
        const data = (await res.json()) as ProveedorRow[] | { error?: string };
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Error");
        setProveedores(data as ProveedorRow[]);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [debouncedQ]);

  const filtrados = useMemo(
    () => filtrarPorSaldo(proveedores, filtroRapido),
    [proveedores, filtroRapido],
  );

  const sorted = useMemo(() => {
    const copy = [...filtrados];
    if (sort.by === "saldo") {
      const base = copy.sort((a, b) => b.saldo - a.saldo);
      return sort.dir === "desc" ? base : base.reverse();
    }
    const base = copy.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return sort.dir === "asc" ? base : base.reverse();
  }, [filtrados, sort]);

  function iconFor(col: "nombre" | "saldo") {
    if (sort.by !== col) return "↕";
    return sort.dir === "asc" ? "↑" : "↓";
  }

  function toggleSort(col: "nombre" | "saldo") {
    setSort((prev) => {
      if (prev.by !== col) {
        return { by: col, dir: col === "saldo" ? "desc" : "asc" };
      }
      return { by: col, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  async function crearProveedor(e: React.FormEvent) {
    e.preventDefault();
    setCrearError(null);
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      setCrearError("Indicá el nombre del proveedor.");
      return;
    }
    setCreando(true);
    try {
      const res = await fetch("/api/proveedores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nombre,
          cuit: cuit.trim() || null,
          razonSocial: razonSocial.trim() || null,
          email: email.trim() || null,
          telefono: telefono.trim() || null,
          condicionIva: condicionIva.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el proveedor");
      setNuevoNombre("");
      setCuit("");
      setRazonSocial("");
      setEmail("");
      setTelefono("");
      setCondicionIva("");
      setMostrarDatosExtra(false);
      abortRef.current?.abort();
      setProveedores((prev) => [
        ...(prev ?? []),
        {
          id: String(data.id ?? ""),
          nombre,
          razonSocial: razonSocial.trim() || null,
          cuit: cuit.trim() || null,
          email: email.trim() || null,
          telefono: telefono.trim() || null,
          condicionIva: condicionIva.trim() || null,
          notas: null,
          saldo: 0,
          ultimoMovimientoFecha: null,
          vencimientoReferencia: null,
        },
      ]);
    } catch (e) {
      setCrearError(e instanceof Error ? e.message : "Error");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="page-shell space-y-8">
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle-quiet max-w-xl">
            Compras (deuda) y pagos a proveedores. Positivo = le debés plata.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/api/proveedores/export" className="btn-secondary">
            Exportar Excel
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Volver al panel
          </Link>
        </div>
      </header>

      <section className="card p-4 sm:p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Alta rápida</h2>
        <form onSubmit={crearProveedor} className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1 max-w-md">
              <label className="label-field" htmlFor="nuevoProveedor">
                Nombre / razón social
              </label>
              <input
                id="nuevoProveedor"
                className="input-app w-full"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej. Corralón San José"
              />
            </div>
            <button type="submit" className="btn-primary shrink-0" disabled={creando}>
              {creando ? "Creando…" : "Crear"}
            </button>
          </div>
          <p className="text-xs">
            <button
              type="button"
              className="text-emerald-800 underline-offset-2 hover:underline"
              onClick={() => setMostrarDatosExtra((v) => !v)}
            >
              Agregar datos de contacto
            </button>
            <span className="text-slate-400"> · opcional</span>
          </p>
          <details
            className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm"
            open={mostrarDatosExtra}
            onToggle={(e) => setMostrarDatosExtra((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer list-none font-medium text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
              + Datos de contacto y facturación <span className="font-normal text-slate-400">(opcional)</span>
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label-field">Razón social</label>
                <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className="input-app" />
              </div>
              <div>
                <label className="label-field">CUIT</label>
                <input value={cuit} onChange={(e) => setCuit(e.target.value)} className="input-app" />
              </div>
              <div>
                <label className="label-field">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-app" />
              </div>
              <div>
                <label className="label-field">Teléfono</label>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input-app" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Condición IVA</label>
                <select
                  value={condicionIva}
                  onChange={(e) => setCondicionIva(e.target.value)}
                  className="select-app max-w-md"
                >
                  <option value="">—</option>
                  <option value="RI">Responsable Inscripto</option>
                  <option value="Monotributo">Monotributo</option>
                  <option value="Exento">Exento</option>
                  <option value="CF">Consumidor Final</option>
                </select>
              </div>
            </div>
          </details>

          <div className="flex justify-end">
            <span className="text-xs text-slate-500">Completá solo nombre para crear rápido.</span>
          </div>
        </form>
        {crearError ? (
          <p className="alert-error mt-3" role="alert">
            {crearError}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Buscar proveedores</h2>
          <span className="section-count">{sorted.length}</span>
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <IconSearch className="size-5" />
          </span>
          <input
            id="q-prov"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, CUIT o razón social"
            className="input-app h-11 w-full pl-10 text-base shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:h-12 sm:pl-11"
            autoComplete="off"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{loading ? "Buscando…" : "\u00a0"}</span>
            {hayBusqueda && (
              <button type="button" className="btn-tertiary" onClick={() => setQ("")}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtro rápido</p>
          <FiltrosProveedores value={filtroRapido} disabled={loading} onChange={setFiltroRapido} />
        </div>

        {error ? (
          <p className="alert-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resultados</h3>
        </div>

        <div className="table-shell touch-pan-x">
          <table className="table-app w-full min-w-[min(100%,48rem)] lg:min-w-[800px]">
            <thead>
              <tr>
                <th className="min-w-0 max-w-[14rem]">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:underline"
                    onClick={() => toggleSort("nombre")}
                    title="Ordenar por nombre"
                  >
                    Proveedor <span className="text-slate-400">{iconFor("nombre")}</span>
                  </button>
                </th>
                <th className="w-[7.5rem] shrink-0 text-right">
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-end gap-1 hover:underline"
                    onClick={() => toggleSort("saldo")}
                    title="Ordenar por saldo"
                  >
                    Saldo <span className="text-slate-400">{iconFor("saldo")}</span>
                  </button>
                </th>
                <th className="hidden w-[6.5rem] shrink-0 md:table-cell">Venc.</th>
                <th className="hidden w-[6.5rem] shrink-0 lg:table-cell">Últ. mov.</th>
                <th className="w-[8rem] shrink-0" />
                <th className="w-16 shrink-0 text-right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.id}
                  className={
                    p.saldo > 0
                      ? "bg-rose-50/35 dark:bg-rose-950/20"
                      : p.saldo < 0
                        ? "bg-emerald-50/20 dark:bg-emerald-950/15"
                        : undefined
                  }
                >
                  <td className="min-w-0 max-w-[14rem] font-medium text-slate-900 dark:text-slate-100">{p.nombre}</td>
                  <td className="w-[7.5rem] shrink-0 text-right">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 font-mono text-sm tabular-nums font-semibold ${
                        p.saldo > 0
                          ? "bg-rose-100/90 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
                          : p.saldo < 0
                            ? "bg-emerald-100/80 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {formatMoneda(p.saldo)}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap text-xs tabular-nums text-slate-600 md:table-cell">
                    {celdaFecha(p.vencimientoReferencia ?? null)}
                  </td>
                  <td className="hidden whitespace-nowrap text-xs tabular-nums text-slate-600 lg:table-cell">
                    {celdaFecha(p.ultimoMovimientoFecha ?? null)}
                  </td>
                  <td className="w-[8rem] shrink-0">
                    <Link href={`/dashboard/proveedores/${p.id}`} className="btn-secondary h-9 px-2 py-0 text-xs">
                      Ver proveedor
                    </Link>
                  </td>
                  <td className="w-16 shrink-0 text-right">
                    <BorrarProveedorButton
                      proveedorId={p.id}
                      nombre={p.nombre}
                      alExito="refrescar"
                      etiqueta="Eliminar"
                      className="btn-ghost py-1.5 px-1 text-xs text-slate-400 opacity-60 hover:text-rose-600 hover:opacity-100 disabled:opacity-40"
                    />
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <div className="empty-state mx-auto max-w-md border-0 bg-transparent">
                      <p className="empty-state-title">
                        {debouncedQ.trim() || filtroRapido !== "todos"
                          ? "No hay proveedores que coincidan"
                          : "Todavía no hay proveedores"}
                      </p>
                      <p className="empty-state-hint">
                        {debouncedQ.trim() || filtroRapido !== "todos"
                          ? "Probá otra búsqueda o cambiá el filtro."
                          : "Creá tu primer proveedor con el alta rápida para empezar a registrar compras y pagos."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
