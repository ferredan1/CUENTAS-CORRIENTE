"use client";

import { useEffect, useMemo, useState } from "react";

type LogCambioRow = {
  id: string;
  entidad: string;
  entidadId: string;
  campo: string;
  valorAntes: string;
  valorDespues: string;
  creadoAt: string;
};

type LogEliminacionRow = {
  id: string;
  entidad: string;
  entidadId: string;
  snapshot: unknown;
  creadoAt: string;
};

function fmtFecha(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("es-AR");
}

export function AuditoriaClient() {
  const [tab, setTab] = useState<"cambios" | "eliminaciones">("cambios");
  const [entidad, setEntidad] = useState("");
  const [entidadId, setEntidadId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cambios, setCambios] = useState<LogCambioRow[]>([]);
  const [eliminaciones, setEliminaciones] = useState<LogEliminacionRow[]>([]);

  const canBuscarCambios = useMemo(() => entidad.trim() && entidadId.trim(), [entidad, entidadId]);

  async function loadCambios() {
    if (!canBuscarCambios) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/audit/cambios?entidad=${encodeURIComponent(entidad.trim())}&entidadId=${encodeURIComponent(
          entidadId.trim(),
        )}`,
      );
      const data = (await res.json().catch(() => null)) as LogCambioRow[] | { error?: string } | null;
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Error");
      setCambios(data as LogCambioRow[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function loadEliminaciones() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/audit/eliminaciones${entidad ? `?entidad=${encodeURIComponent(entidad)}` : ""}`);
      const data = (await res.json().catch(() => null)) as LogEliminacionRow[] | { error?: string } | null;
      if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Error");
      setEliminaciones(data as LogEliminacionRow[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setErr(null);
    if (tab === "eliminaciones") void loadEliminaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="page-shell space-y-6">
      <header className="border-b border-slate-200/80 pb-6">
        <h1 className="page-title">Auditoría</h1>
        <p className="page-subtitle-quiet max-w-xl text-slate-500">
          Historial de cambios por campo y registro de eliminaciones con snapshot.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <a href="/api/export/datos" className="text-emerald-800 underline-offset-2 hover:underline">
            Descargar respaldo de datos (JSON)
          </a>
        </p>
      </header>

      <div className="segmented flex w-full min-w-0 max-w-xl touch-pan-x print:hidden">
        <button
          type="button"
          onClick={() => setTab("cambios")}
          className={`segmented-btn ${tab === "cambios" ? "segmented-btn-active" : ""}`}
        >
          Cambios
        </button>
        <button
          type="button"
          onClick={() => setTab("eliminaciones")}
          className={`segmented-btn ${tab === "eliminaciones" ? "segmented-btn-active" : ""}`}
        >
          Eliminaciones
        </button>
      </div>

      <section className="card-compact space-y-3 print:hidden">
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="label-field">Entidad</span>
            <input className="input-app" value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="movimiento / cliente / …" />
          </label>
          <label className="sm:col-span-2">
            <span className="label-field">Entidad ID</span>
            <input className="input-app" value={entidadId} onChange={(e) => setEntidadId(e.target.value)} placeholder="cuid()" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === "cambios" ? (
            <button type="button" className="btn-secondary" disabled={!canBuscarCambios || loading} onClick={() => void loadCambios()}>
              Buscar cambios
            </button>
          ) : (
            <button type="button" className="btn-secondary" disabled={loading} onClick={() => void loadEliminaciones()}>
              Recargar eliminaciones
            </button>
          )}
        </div>

        {err ? (
          <p className="alert-error" role="alert">
            {err}
          </p>
        ) : null}
      </section>

      {tab === "cambios" ? (
        <section className="table-shell">
          <table className="table-app w-full min-w-[min(100%,56rem)]">
            <thead>
              <tr>
                <th className="w-44">Fecha</th>
                <th className="w-36">Entidad</th>
                <th className="w-56">Entidad ID</th>
                <th className="w-40">Campo</th>
                <th>Antes</th>
                <th>Después</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {!loading && cambios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Indicá entidad + entidadId y buscá cambios.
                  </td>
                </tr>
              ) : null}
              {!loading &&
                cambios.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-slate-600">{fmtFecha(r.creadoAt)}</td>
                    <td className="font-mono text-xs">{r.entidad}</td>
                    <td className="font-mono text-xs">{r.entidadId}</td>
                    <td className="font-mono text-xs">{r.campo}</td>
                    <td className="max-w-[22rem] truncate font-mono text-xs text-slate-600" title={r.valorAntes}>
                      {r.valorAntes}
                    </td>
                    <td className="max-w-[22rem] truncate font-mono text-xs text-slate-900" title={r.valorDespues}>
                      {r.valorDespues}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="table-shell">
          <table className="table-app w-full min-w-[min(100%,56rem)]">
            <thead>
              <tr>
                <th className="w-44">Fecha</th>
                <th className="w-36">Entidad</th>
                <th className="w-56">Entidad ID</th>
                <th>Snapshot</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500">
                    Cargando…
                  </td>
                </tr>
              ) : null}
              {!loading && eliminaciones.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500">
                    Sin eliminaciones registradas.
                  </td>
                </tr>
              ) : null}
              {!loading &&
                eliminaciones.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-slate-600">{fmtFecha(r.creadoAt)}</td>
                    <td className="font-mono text-xs">{r.entidad}</td>
                    <td className="font-mono text-xs">{r.entidadId}</td>
                    <td>
                      <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-[0.7rem] text-slate-700 ring-1 ring-slate-200/80">
                        {JSON.stringify(r.snapshot, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
