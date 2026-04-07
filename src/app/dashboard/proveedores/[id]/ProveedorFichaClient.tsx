"use client";

import { IconClock, IconTrash } from "@/components/UiIcons";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import { TIPOS_MOVIMIENTO_PROVEEDOR } from "@/types/domain";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ProveedorDatosTab } from "./ProveedorDatosTab";
import type { ProveedorDTO } from "./proveedor-ficha-types";

type MovRow = {
  id: string;
  fecha: string;
  comprobante: string | null;
  codigoProducto: string | null;
  tipo: string;
  descripcion: string;
  notas: string | null;
  cantidad: number;
  precioUnitario: number;
  total: number;
  liquidadoAt: string | null;
};

function isoADia(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const TIPOS = TIPOS_MOVIMIENTO_PROVEEDOR;

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangoResumenDesdeHasta(mode: "90d" | "trimestre"): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = ymdLocal(hoy);
  if (mode === "90d") {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 90);
    return { desde: ymdLocal(d), hasta };
  }
  const month = hoy.getMonth();
  const qStart = Math.floor(month / 3) * 3;
  const desde = new Date(hoy.getFullYear(), qStart, 1);
  const finTrim = new Date(hoy.getFullYear(), qStart + 3, 0);
  return { desde: ymdLocal(desde), hasta: ymdLocal(finTrim) };
}

export function ProveedorFichaClient({ proveedor }: { proveedor: ProveedorDTO }) {
  const canDeleteMov = true;
  const [tab, setTab] = useState<"resumen" | "movimientos" | "datos">("resumen");
  const [rows, setRows] = useState<MovRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [rangoResumen, setRangoResumen] = useState<"90d" | "trimestre">("90d");
  const [porTipoResumen, setPorTipoResumen] = useState<Record<string, number>>({});
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [tipoForm, setTipoForm] = useState("compra");
  const [showNotasCols, setShowNotasCols] = useState(false);

  const saldoLive = useMemo(() => {
    const totales: Record<string, number> = {};
    for (const r of rows) {
      if (r.tipo === "compra" && r.liquidadoAt) {
        totales["pago"] = (totales["pago"] ?? 0) + r.total;
      } else {
        totales[r.tipo] = (totales[r.tipo] ?? 0) + r.total;
      }
    }
    const compras = (totales["compra"] ?? 0) + (totales["ajuste"] ?? 0);
    const pagos = totales["pago"] ?? 0;
    return compras - pagos;
  }, [rows]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    if (tipoFiltro) p.set("tipo", tipoFiltro);
    p.set("limit", "5000");
    return p.toString();
  }, [desde, hasta, tipoFiltro]);

  useLayoutEffect(() => {
    const h = window.location.hash.replace("#", "").trim();
    if (h === "movimientos" || h === "datos" || h === "resumen") setTab(h);
  }, []);
  useEffect(() => {
    const next = `#${tab}`;
    if (window.location.hash === next) return;
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", `${base}${next}`);
  }, [tab]);

  async function loadMovs() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/proveedores/${proveedor.id}/movimientos?${query}`);
      const data = (await res.json()) as (Partial<MovRow> & { id: string })[] | { error?: string };
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Error");
      const list = data as Partial<MovRow>[];
      setRows(
        list.map((r) => ({
          id: r.id!,
          fecha: String(r.fecha ?? ""),
          comprobante: r.comprobante ?? null,
          codigoProducto: r.codigoProducto ?? null,
          tipo: String(r.tipo ?? ""),
          descripcion: String(r.descripcion ?? ""),
          notas: (r as { notas?: string | null }).notas ?? null,
          cantidad: Number(r.cantidad ?? 0),
          precioUnitario: Number(r.precioUnitario ?? 0),
          total: Number(r.total ?? 0),
          liquidadoAt: (r as { liquidadoAt?: string | null }).liquidadoAt ?? null,
        })),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function patchRow(id: string, partial: Partial<MovRow>) {
    setErr(null);
    try {
      const res = await fetch(`/api/proveedores/${proveedor.id}/movimientos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: partial.fecha,
          comprobante: partial.comprobante,
          codigoProducto: partial.codigoProducto,
          tipo: partial.tipo,
          descripcion: partial.descripcion,
          notas: partial.notas,
          cantidad: partial.cantidad,
          precioUnitario: partial.precioUnitario,
          liquidadoAt: partial.liquidadoAt,
        }),
      });
      const data = (await res.json()) as MovRow & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error");
      const actualizado: MovRow = {
        id: data.id,
        fecha: String(data.fecha),
        comprobante: data.comprobante ?? null,
        codigoProducto: data.codigoProducto ?? null,
        tipo: String(data.tipo ?? ""),
        descripcion: String(data.descripcion ?? ""),
        notas: (data as { notas?: string | null }).notas ?? null,
        cantidad: Number(data.cantidad ?? 0),
        precioUnitario: Number(data.precioUnitario ?? 0),
        total: Number(data.total ?? 0),
        liquidadoAt: (data as { liquidadoAt?: string | null }).liquidadoAt ?? null,
      };
      setRows((prev) => prev.map((r) => (r.id === id ? actualizado : r)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  async function deleteRow(id: string) {
    setErr(null);
    try {
      const res = await fetch(`/api/proveedores/${proveedor.id}/movimientos/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo eliminar");
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  async function crearMovimiento(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const tipo = String(fd.get("tipo") ?? "");
    const fecha = String(fd.get("fecha") ?? "");
    const comprobante = String(fd.get("comprobante") ?? "").trim();
    const descripcion = String(fd.get("descripcion") ?? "").trim();
    const cantidad = Number(fd.get("cantidad") ?? 1);
    const precioUnitario = Number(fd.get("precioUnitario") ?? 0);

    if (!tipo || !descripcion || !Number.isFinite(cantidad) || !Number.isFinite(precioUnitario)) {
      setErr("Completá tipo, descripción, cantidad y precio unitario.");
      return;
    }

    if (guardando) return;
    setGuardando(true);
    try {
      const fechaVencimiento = String(fd.get("fechaVencimiento") ?? "").trim();
      const body: Record<string, unknown> = {
        tipo,
        fecha: fecha ? new Date(`${fecha}T12:00:00`).toISOString() : undefined,
        comprobante: comprobante || null,
        descripcion,
        cantidad,
        precioUnitario,
      };
      if (tipo === "compra" && fechaVencimiento) {
        body.fechaVencimiento = fechaVencimiento;
      }
      const res = await fetch(`/api/proveedores/${proveedor.id}/movimientos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el movimiento");
      form.reset();
      await loadMovs();
      setTab("movimientos");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setGuardando(false);
    }
  }

  useEffect(() => {
    if (tab !== "movimientos") return;
    void loadMovs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, query]);

  useEffect(() => {
    if (tab !== "resumen") return;
    const { desde, hasta } = rangoResumenDesdeHasta(rangoResumen);
    setLoadingResumen(true);
    void (async () => {
      try {
        const p = new URLSearchParams();
        p.set("desde", desde);
        p.set("hasta", hasta);
        const res = await fetch(`/api/proveedores/${proveedor.id}/movimientos/resumen?${p}`);
        const data = (await res.json()) as { porTipo?: Record<string, number>; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Error");
        setPorTipoResumen(data.porTipo ?? {});
      } catch {
        setPorTipoResumen({});
      } finally {
        setLoadingResumen(false);
      }
    })();
  }, [tab, rangoResumen, proveedor.id]);

  return (
    <div className="page-shell space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/dashboard/proveedores" className="hover:underline">
              Proveedores
            </Link>
            <span>/</span>
            <span className="text-slate-700">{proveedor.nombre}</span>
          </div>
          <h1 className="page-title mt-1">{proveedor.nombre}</h1>
          <p className="page-subtitle-quiet max-w-xl">
            Saldo:{" "}
            <span className="font-semibold">
              {tab === "movimientos" ? formatMoneda(saldoLive) : formatMoneda(proveedor.saldo)}
            </span>
            {proveedor.ultimoMovimiento ? (
              <>
                {" "}
                · Último: {proveedor.ultimoMovimiento.tipo} —{" "}
                {formatFechaCorta(proveedor.ultimoMovimiento.fecha)}{" "}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard" className="btn-secondary">
            Panel
          </Link>
        </div>
      </header>

      <div className="segmented w-full min-w-0 touch-pan-x sm:w-auto">
        <button
          type="button"
          className={`segmented-btn ${tab === "resumen" ? "segmented-btn-active" : ""}`}
          onClick={() => setTab("resumen")}
        >
          Resumen
        </button>
        <button
          type="button"
          className={`segmented-btn ${tab === "movimientos" ? "segmented-btn-active" : ""}`}
          onClick={() => setTab("movimientos")}
        >
          Movimientos <span className="section-count">{proveedor.movimientosCount}</span>
        </button>
        <button
          type="button"
          className={`segmented-btn ${tab === "datos" ? "segmented-btn-active" : ""}`}
          onClick={() => setTab("datos")}
        >
          Datos
        </button>
      </div>

      {err ? (
        <p className="alert-error" role="alert">
          {err}
        </p>
      ) : null}

      {tab === "resumen" ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Acciones rápidas</h2>
            <form onSubmit={crearMovimiento} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label-field" htmlFor="tipo">
                  Tipo
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  className="select-app capitalize"
                  value={tipoForm}
                  onChange={(e) => setTipoForm(e.target.value)}
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field" htmlFor="fecha">
                  Fecha
                </label>
                <input id="fecha" name="fecha" type="date" className="input-app" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field" htmlFor="comprobante">
                  Comprobante (opcional)
                </label>
                <input id="comprobante" name="comprobante" className="input-app" />
              </div>
              {tipoForm === "compra" ? (
                <div className="sm:col-span-2">
                  <label className="label-field" htmlFor="fechaVencimiento">
                    Vencimiento factura (opcional)
                  </label>
                  <input id="fechaVencimiento" name="fechaVencimiento" type="date" className="input-app" />
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <label className="label-field" htmlFor="descripcion">
                  Descripción
                </label>
                <input id="descripcion" name="descripcion" className="input-app" required />
              </div>
              <div>
                <label className="label-field" htmlFor="cantidad">
                  Cantidad
                </label>
                <input id="cantidad" name="cantidad" type="number" step="any" className="input-app font-mono" defaultValue={1} />
              </div>
              <div>
                <label className="label-field" htmlFor="precioUnitario">
                  Precio unitario
                </label>
                <input id="precioUnitario" name="precioUnitario" type="number" step="any" className="input-app font-mono" defaultValue={0} />
              </div>
              <div className="sm:col-span-2">
                <button type="submit" className="btn-primary w-full" disabled={guardando}>
                  {guardando ? "Guardando…" : "Agregar movimiento"}
                </button>
              </div>
            </form>
          </div>

          <div className="card p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Saldo</h2>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoneda(proveedor.saldo)}</p>
            <p className="mt-1 text-sm text-slate-600">Positivo = deuda con el proveedor.</p>
          </div>

          <div className="card p-5 lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Totales por tipo (rango)
              </h2>
              <select
                className="select-app text-sm"
                value={rangoResumen}
                onChange={(e) => setRangoResumen(e.target.value as "90d" | "trimestre")}
              >
                <option value="90d">Últimos 90 días</option>
                <option value="trimestre">Trimestre calendario actual</option>
              </select>
            </div>
            {loadingResumen ? (
              <p className="mt-3 text-sm text-slate-500">Cargando…</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {TIPOS.map((t) => (
                  <li key={t} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <p className="text-xs capitalize text-slate-500">{t}</p>
                    <p className="font-mono text-lg font-semibold text-slate-900">
                      {formatMoneda(porTipoResumen[t] ?? 0)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {tab === "datos" ? <ProveedorDatosTab proveedor={proveedor} /> : null}

      {tab === "movimientos" ? (
        <section className="space-y-4">
          <div className="card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="label-field">Desde</label>
                <input type="date" className="input-app" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div>
                <label className="label-field">Hasta</label>
                <input type="date" className="input-app" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
              <div>
                <label className="label-field">Tipo</label>
                <select className="select-app capitalize" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
                  <option value="">Todos</option>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNotasCols((v) => !v)}
                className={`btn-secondary text-sm ${showNotasCols ? "ring-2 ring-emerald-200/80" : ""}`}
              >
                {showNotasCols ? "Ocultar notas" : "Mostrar notas"}
              </button>
              <button type="button" onClick={() => void loadMovs()} className="btn-secondary text-sm">
                Recargar
              </button>
            </div>
          </div>

          <div className="table-shell">
            <table className="table-app w-full min-w-[min(100%,54rem)]">
              <thead>
                <tr>
                  <th className="w-28">Fecha</th>
                  <th className="w-36">Comprobante</th>
                  <th className="w-28">Tipo</th>
                  <th>Descripción</th>
                  {showNotasCols ? <th>Notas</th> : null}
                  <th className="w-24 text-right">Cant.</th>
                  <th className="w-28 text-right">P. unit</th>
                  <th className="w-28 text-right">Total</th>
                  <th className="w-28">Estado</th>
                  <th className="w-28 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={showNotasCols ? 10 : 9} className="py-10 text-center text-sm text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                ) : null}
                {!loading &&
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="p-0">
                        <input
                          type="date"
                          defaultValue={isoADia(r.fecha)}
                          className="excel-cell-input w-full border-0 bg-transparent px-2 py-1.5 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
                          onBlur={(e) => {
                            const v = e.target.value;
                            const iso = v ? new Date(`${v}T12:00:00`).toISOString() : r.fecha;
                            if (iso !== r.fecha) void patchRow(r.id, { fecha: iso });
                          }}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          defaultValue={r.comprobante ?? ""}
                          className="excel-cell-input w-full border-0 bg-transparent px-2 py-1.5 font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
                          onBlur={(e) => {
                            const v = e.target.value.trim() || null;
                            if (v !== (r.comprobante ?? "")) void patchRow(r.id, { comprobante: v });
                          }}
                        />
                      </td>
                      <td className="p-0">
                        <select
                          defaultValue={r.tipo}
                          className="w-full cursor-pointer border-0 bg-transparent px-2 py-1.5 text-xs capitalize focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
                          onChange={(e) => void patchRow(r.id, { tipo: e.target.value })}
                        >
                          {TIPOS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-0">
                        <textarea
                          defaultValue={r.descripcion}
                          rows={2}
                          className="excel-cell-input min-h-[3rem] w-full resize-y break-words border-0 bg-transparent px-2 py-2 text-xs leading-snug focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v !== r.descripcion) void patchRow(r.id, { descripcion: v });
                          }}
                        />
                        {r.tipo === "compra" && r.liquidadoAt ? (
                          <div className="px-2 pb-2">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/70">
                              Pagada
                            </span>
                          </div>
                        ) : null}
                      </td>
                      {showNotasCols ? (
                        <td className="p-0 align-top">
                          <textarea
                            defaultValue={r.notas ?? ""}
                            rows={2}
                            placeholder="Notas…"
                            className="excel-cell-input min-h-[3rem] w-full resize-y break-words border-0 bg-transparent px-2 py-2 text-xs leading-snug focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
                            onBlur={(e) => {
                              const v = e.target.value;
                              const next = v.trim() ? v : null;
                              if (next !== (r.notas ?? null)) void patchRow(r.id, { notas: next });
                            }}
                          />
                        </td>
                      ) : null}
                      <td className="p-0">
                        <input
                          type="number"
                          step="any"
                          defaultValue={r.cantidad}
                          className="excel-cell-input w-full border-0 bg-transparent px-2 py-1.5 text-right font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== r.cantidad) void patchRow(r.id, { cantidad: v });
                          }}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="number"
                          step="any"
                          defaultValue={r.precioUnitario}
                          className="excel-cell-input w-full border-0 bg-transparent px-2 py-1.5 text-right font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v !== r.precioUnitario) void patchRow(r.id, { precioUnitario: v });
                          }}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-slate-800">
                        {formatMoneda(r.total)}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-600">
                        {r.tipo === "compra" && !r.liquidadoAt ? (
                          <button
                            type="button"
                            className="btn-tertiary h-7 px-2 py-0 text-[0.65rem]"
                            onClick={() => void patchRow(r.id, { liquidadoAt: new Date().toISOString() })}
                          >
                            Marcar pagada
                          </button>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          className="btn-ghost py-1.5 px-2 text-xs text-slate-400 opacity-60 hover:text-slate-700 hover:opacity-100"
                          title="Ver historial de cambios"
                          onClick={async () => {
                            try {
                              const res = await fetch(
                                `/api/audit/cambios?entidad=movimiento_proveedor&entidadId=${encodeURIComponent(r.id)}`,
                              );
                              const data = (await res.json().catch(() => null)) as
                                | { error?: string }
                                | Array<{ creadoAt: string; campo: string; valorAntes: string; valorDespues: string }>;
                              if (!res.ok) throw new Error((data as { error?: string }).error ?? "Error");
                              const rows = data as Array<{
                                creadoAt: string;
                                campo: string;
                                valorAntes: string;
                                valorDespues: string;
                              }>;
                              if (rows.length === 0) {
                                alert("Sin cambios registrados para esta fila.");
                                return;
                              }
                              alert(
                                rows
                                  .slice(0, 12)
                                  .map(
                                    (x) =>
                                      `${new Date(x.creadoAt).toLocaleString("es-AR")} · ${x.campo}: ${x.valorAntes} → ${x.valorDespues}`,
                                  )
                                  .join("\n"),
                              );
                            } catch (e) {
                              alert(e instanceof Error ? e.message : "Error");
                            }
                          }}
                        >
                          <IconClock className="size-4" />
                        </button>
                        {canDeleteMov && deleteConfirmId === r.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className="btn-secondary h-7 px-2 py-0 text-[0.65rem]"
                              onClick={() => void deleteRow(r.id)}
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              className="btn-tertiary h-7 px-2 py-0 text-[0.65rem]"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              No
                            </button>
                          </span>
                        ) : canDeleteMov ? (
                          <button
                            type="button"
                            className="btn-ghost py-1.5 px-2 text-xs text-slate-400 opacity-60 hover:text-rose-600 hover:opacity-100"
                            title="Eliminar"
                            onClick={() => setDeleteConfirmId(r.id)}
                          >
                            <IconTrash className="size-4" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center">
                      <div className="empty-state mx-auto max-w-md border-0 bg-transparent">
                        <p className="empty-state-title">No hay movimientos</p>
                        <p className="empty-state-hint">Usá “Agregar movimiento” en Resumen para cargar el primero.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

