"use client";

import { IconCheck, IconClock, IconTrash } from "@/components/UiIcons";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import { acumularPorTipo, saldoDesdeTotalesPorTipo, totalesPendientesDesdeFilas } from "@/domain/saldos";
import type { TipoMovimiento } from "@/types/domain";
import Link from "next/link";
import { ModalAplicarPago } from "@/components/pagos/ModalAplicarPago";
import { useCallback, useEffect, useMemo, useState } from "react";

type MovRow = {
  id: string;
  fecha: string;
  comprobante: string | null;
  medioPago: string | null;
  chequeNumero: string | null;
  liquidadoAt?: string | null;
  chequeVencimiento: string;
  fechaRecepcion: string;
  codigoProducto: string | null;
  tipo: string;
  descripcion: string;
  notas: string | null;
  cantidad: number;
  precioUnitario: number;
  total: number;
  saldoPendiente?: number;
  archivoId: string | null;
};

function isoADia(s: string | null | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Para filtrar la grilla (incluye tipos históricos). */
const TIPOS_FILTRO: TipoMovimiento[] = ["venta", "pago", "devolucion", "ajuste"];

/** Tipos permitidos al editar; filas históricas con devolución/ajuste conservan su valor hasta que se cambie. */
function tipoOpcionesFila(r: MovRow): TipoMovimiento[] {
  const base: TipoMovimiento[] = ["venta", "pago"];
  const t = r.tipo as TipoMovimiento;
  if (t === "devolucion" || t === "ajuste") return [...base, t];
  return base;
}

function rowKey(r: MovRow): string {
  return [
    r.id,
    r.fecha,
    r.comprobante ?? "",
    r.medioPago ?? "",
    r.chequeNumero ?? "",
    r.chequeVencimiento,
    r.fechaRecepcion,
    r.tipo,
    r.descripcion,
    r.notas ?? "",
    r.cantidad,
    r.precioUnitario,
    r.total,
    r.saldoPendiente ?? "",
  ].join("|");
}

function groupKeyForRow(r: MovRow): string | null {
  const c = r.comprobante?.trim();
  if (!c) return null;
  return `${c}|${r.fecha.slice(0, 10)}`;
}

type Segment =
  | { kind: "single"; rows: MovRow[] }
  | {
      kind: "group";
      labelComp: string;
      labelFecha: string;
      total: number;
      rows: MovRow[];
    };

function buildSegments(rows: MovRow[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i]!;
    const gk = groupKeyForRow(r);
    if (!gk) {
      out.push({ kind: "single", rows: [r] });
      i += 1;
      continue;
    }
    const chunk: MovRow[] = [r];
    i += 1;
    while (i < rows.length) {
      const next = rows[i]!;
      if (groupKeyForRow(next) === gk) {
        chunk.push(next);
        i += 1;
      } else break;
    }
    const total = chunk.reduce((s, x) => s + x.total, 0);
    out.push({
      kind: "group",
      labelComp: r.comprobante!.trim(),
      labelFecha: r.fecha.slice(0, 10),
      total,
      rows: chunk,
    });
  }
  return out;
}

export type ObraMovimientosClientProps =
  | {
      obraId: string;
      clienteId: string;
      saldoObra: number;
      sinObra?: false;
      todoCliente?: false;
    }
  | {
      clienteId: string;
      saldoObra: number;
      sinObra: true;
      todoCliente?: false;
    }
  | {
      clienteId: string;
      saldoObra: number;
      todoCliente: true;
    };

export function ObraMovimientosClient(props: ObraMovimientosClientProps) {
    const todoCliente = "todoCliente" in props && props.todoCliente === true;
    const sinObra = !todoCliente && "sinObra" in props && props.sinObra === true;
    const obraId = !todoCliente && !sinObra ? props.obraId : undefined;
    const clienteId = props.clienteId;
    const saldoInicial = props.saldoObra;
    const canDeleteMov = true;

    const [rows, setRows] = useState<MovRow[]>([]);
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [tipoFiltro, setTipoFiltro] = useState("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [showChequeCols, setShowChequeCols] = useState(false);
    const [showExtraMobileCols, setShowExtraMobileCols] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
    const [showNotasCols, setShowNotasCols] = useState(false);
    const [marcarPagoRow, setMarcarPagoRow] = useState<MovRow | null>(null);
    const [marcarPagoMedio, setMarcarPagoMedio] = useState<
      "efectivo" | "transferencia" | "cheque" | "tarjeta_debito" | "tarjeta_credito"
    >("efectivo");
    const [marcarPagoChequeBanco, setMarcarPagoChequeBanco] = useState("");
    const [marcarPagoChequeNumero, setMarcarPagoChequeNumero] = useState("");
    const [marcarPagoChequeVencimiento, setMarcarPagoChequeVencimiento] = useState("");
    const [marcarPagoFechaRecepcion, setMarcarPagoFechaRecepcion] = useState("");
    const [marcarPagoLoading, setMarcarPagoLoading] = useState(false);
    const [modalPagoParcialOpen, setModalPagoParcialOpen] = useState(false);

    const mobileExtraColsClass = showExtraMobileCols ? "" : "hidden md:table-cell";

    const query = useMemo(() => {
      const p = new URLSearchParams();
      if (todoCliente) {
        p.set("clienteId", clienteId);
      } else if (sinObra) {
        p.set("clienteId", clienteId);
        p.set("sinObra", "true");
      } else {
        p.set("obraId", obraId!);
      }
    if (desde) p.set("desde", desde);
    if (hasta) p.set("hasta", hasta);
    if (tipoFiltro) p.set("tipo", tipoFiltro);
    p.set("limit", "5000");
    return p.toString();
    }, [todoCliente, sinObra, clienteId, obraId, desde, hasta, tipoFiltro]);

    const saldoLive = useMemo(() => {
      const tot = acumularPorTipo(rows.map((r) => ({ tipo: r.tipo, total: r.total })));
      return saldoDesdeTotalesPorTipo(tot);
    }, [rows]);

    const saldoActual = useMemo(() => {
      const tot = totalesPendientesDesdeFilas(
        rows.map((r) => ({
          tipo: r.tipo,
          total: r.total,
          liquidadoAt: r.liquidadoAt,
          saldoPendiente: r.tipo === "venta" ? (r.saldoPendiente ?? r.total) : undefined,
        })),
      );
      return saldoDesdeTotalesPorTipo(tot);
    }, [rows]);

    const obraIdParaPago = todoCliente || sinObra ? null : obraId ?? null;

    const ventasPendientesModal = useMemo(() => {
      return rows
        .filter((r) => {
          if (r.tipo !== "venta" || r.liquidadoAt) return false;
          const pend = r.saldoPendiente ?? r.total;
          return pend > 0;
        })
        .map((r) => ({
          id: r.id,
          comprobante: r.comprobante,
          total: r.total,
          saldoPendiente: r.saldoPendiente ?? r.total,
        }));
    }, [rows]);

    const segments = useMemo(() => buildSegments(rows), [rows]);

    const load = useCallback(async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/movimientos?${query}`);
        const data = (await res.json()) as (Partial<MovRow> & Pick<MovRow, "id">)[] | { error?: string };
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Error");
        const list = data as Partial<MovRow>[];
        setRows(
          list.map((r) => ({
            id: r.id!,
            fecha: String(r.fecha ?? ""),
            comprobante: r.comprobante ?? null,
            medioPago: r.medioPago ?? null,
            chequeNumero: r.chequeNumero ?? null,
            liquidadoAt: (r as { liquidadoAt?: string | null }).liquidadoAt ?? null,
            chequeVencimiento: isoADia(
              (r as { chequeVencimiento?: string | null }).chequeVencimiento ?? undefined,
            ),
            fechaRecepcion: isoADia(
              (r as { fechaRecepcion?: string | null }).fechaRecepcion ?? undefined,
            ),
            codigoProducto: r.codigoProducto ?? null,
            tipo: String(r.tipo ?? ""),
            descripcion: String(r.descripcion ?? ""),
            notas: (r as { notas?: string | null }).notas ?? null,
            cantidad: Number(r.cantidad ?? 0),
            precioUnitario: Number(r.precioUnitario ?? 0),
            total: Number(r.total ?? 0),
            saldoPendiente: Number(
              (r as { saldoPendiente?: number }).saldoPendiente ?? r.total ?? 0,
            ),
            archivoId: r.archivoId ?? null,
          })),
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    }, [query]);

    useEffect(() => {
      void load();
    }, [load]);

    type MovRowPatch = Partial<Omit<MovRow, "chequeVencimiento" | "fechaRecepcion">> & {
      chequeVencimiento?: string | null;
      fechaRecepcion?: string | null;
    };

    async function patchRow(id: string, partial: MovRowPatch) {
      setSavingId(id);
      setSavedId(null);
      setErr(null);
      setRowErrors((prev) => {
        if (!prev[id]) return prev;
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      try {
        const res = await fetch(`/api/movimientos/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fecha: partial.fecha,
            comprobante: partial.comprobante,
            codigoProducto: partial.codigoProducto,
            medioPago: partial.medioPago,
            chequeNumero: partial.chequeNumero,
            chequeVencimiento: partial.chequeVencimiento,
            fechaRecepcion: partial.fechaRecepcion,
            liquidadoAt: partial.liquidadoAt,
            descripcion: partial.descripcion,
            notas: (partial as { notas?: string | null }).notas,
            cantidad: partial.cantidad,
            precioUnitario: partial.precioUnitario,
            tipo: partial.tipo,
          }),
        });
        type PatchRes = MovRow & { error?: string };
        const data = (await res.json()) as PatchRes;
        if (!res.ok) throw new Error(data.error ?? "Error");
        const actualizado: MovRow = {
          id: data.id,
          fecha: String(data.fecha),
          comprobante: data.comprobante,
          medioPago: data.medioPago ?? null,
          chequeNumero: data.chequeNumero ?? null,
          liquidadoAt: (data as { liquidadoAt?: string | null }).liquidadoAt ?? null,
          chequeVencimiento: isoADia(
            (data as { chequeVencimiento?: string | null }).chequeVencimiento ?? undefined,
          ),
          fechaRecepcion: isoADia(
            (data as { fechaRecepcion?: string | null }).fechaRecepcion ?? undefined,
          ),
          codigoProducto: data.codigoProducto ?? null,
          tipo: data.tipo,
          descripcion: data.descripcion,
          notas: (data as { notas?: string | null }).notas ?? null,
          cantidad: data.cantidad,
          precioUnitario: data.precioUnitario,
          total: data.total,
          saldoPendiente: Number(
            (data as { saldoPendiente?: number }).saldoPendiente ?? data.total ?? 0,
          ),
          archivoId: data.archivoId ?? null,
        };
        setRows((prev) => prev.map((r) => (r.id === id ? actualizado : r)));
        setSavedId(id);
        window.setTimeout(() => setSavedId((cur) => (cur === id ? null : cur)), 1400);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error";
        setErr(msg);
        setRowErrors((prev) => ({ ...prev, [id]: msg }));
      } finally {
        setSavingId(null);
      }
    }

    const colCount = (showChequeCols ? 12 : 8) + (showNotasCols ? 1 : 0);

    async function confirmMarcarPagoDesdeGrilla() {
      if (!marcarPagoRow) return;
      setMarcarPagoLoading(true);
      setErr(null);
      try {
        const r = marcarPagoRow;
        if (r.archivoId) {
          const res = await fetch(`/api/archivos/${encodeURIComponent(r.archivoId)}/liquidar`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              movimientoId: r.id,
              medioPago: marcarPagoMedio,
              chequeBanco: marcarPagoMedio === "cheque" ? marcarPagoChequeBanco : null,
              chequeNumero: marcarPagoMedio === "cheque" ? marcarPagoChequeNumero : null,
              chequeVencimiento: marcarPagoMedio === "cheque" ? marcarPagoChequeVencimiento : null,
              fechaRecepcion: marcarPagoMedio === "cheque" ? marcarPagoFechaRecepcion : null,
            }),
          });
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!res.ok) throw new Error(data?.error ?? "No se pudo registrar el pago");
        } else {
          const res = await fetch("/api/pagos", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              clienteId,
              fecha: new Date().toISOString(),
              monto: r.saldoPendiente ?? r.total,
              comprobante: r.comprobante,
              medioPago: marcarPagoMedio,
              descripcion: `Pago ${r.comprobante ?? "venta"} (desde grilla)`,
              liquidarVentaId: r.id,
              chequeBanco: marcarPagoMedio === "cheque" ? marcarPagoChequeBanco : null,
              chequeNumero: marcarPagoMedio === "cheque" ? marcarPagoChequeNumero : null,
              chequeVencimiento: marcarPagoMedio === "cheque" ? marcarPagoChequeVencimiento : null,
              fechaRecepcion: marcarPagoMedio === "cheque" ? marcarPagoFechaRecepcion : null,
            }),
          });
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!res.ok) throw new Error(data?.error ?? "No se pudo registrar el pago");
        }
        setMarcarPagoRow(null);
        setMarcarPagoMedio("efectivo");
        setMarcarPagoChequeBanco("");
        setMarcarPagoChequeNumero("");
        setMarcarPagoChequeVencimiento("");
        setMarcarPagoFechaRecepcion("");
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setMarcarPagoLoading(false);
      }
    }

    function renderRow(r: MovRow) {
      const rowErr = rowErrors[r.id] ?? null;
      const baseRow = "group border-b border-slate-100 transition-colors";
      const rowBg = rowErr
        ? "bg-rose-50/30"
        : r.tipo === "pago"
          ? "bg-emerald-50/40 dark:bg-emerald-950/25"
          : "hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20";
      return (
        <tr key={rowKey(r)} className={`${baseRow} ${rowBg}`}>
          <td className="border-r border-slate-100 p-0">
            <input
              type="date"
              className="excel-cell-input w-full border-0 bg-transparent px-2 py-1.5 font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
              defaultValue={r.fecha.slice(0, 10)}
              onBlur={(e) => {
                const v = e.target.value;
                if (v && v !== r.fecha.slice(0, 10)) {
                  const iso = new Date(`${v}T12:00:00`).toISOString();
                  void patchRow(r.id, { fecha: iso });
                }
              }}
            />
          </td>
          <td className="border-r border-slate-100 p-0">
            <input
              defaultValue={r.comprobante ?? ""}
              className="excel-cell-input w-full border-0 bg-transparent px-2 py-1.5 text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
              onBlur={(e) => {
                const v = e.target.value || null;
                if (v !== (r.comprobante ?? "")) void patchRow(r.id, { comprobante: v });
              }}
            />
          </td>
          {showChequeCols && (
            <>
              <td className={`border-r border-slate-100 p-0 ${mobileExtraColsClass}`}>
                <select
                  defaultValue={r.medioPago ?? ""}
                  disabled={r.tipo !== "pago"}
                  className="w-full cursor-pointer border-0 bg-transparent px-1 py-1.5 text-xs capitalize focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(e) => {
                    const v = e.target.value || null;
                    void patchRow(r.id, {
                      medioPago: v,
                      ...(v !== "cheque"
                        ? { chequeNumero: null, chequeVencimiento: "", fechaRecepcion: "" }
                        : {}),
                    });
                  }}
                >
                  <option value="">—</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta_debito">Tarjeta débito</option>
                  <option value="tarjeta_credito">Tarjeta crédito</option>
                </select>
              </td>
              <td className={`border-r border-slate-100 p-0 ${mobileExtraColsClass}`}>
                <input
                  defaultValue={r.chequeNumero ?? ""}
                  disabled={r.tipo !== "pago"}
                  className="excel-cell-input w-full border-0 bg-transparent px-2 py-1.5 font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset disabled:opacity-50"
                  onBlur={(e) => {
                    const v = e.target.value.trim() || null;
                    if (v !== (r.chequeNumero ?? "")) void patchRow(r.id, { chequeNumero: v });
                  }}
                />
              </td>
              <td className={`border-r border-slate-100 p-0 ${mobileExtraColsClass}`}>
                <input
                  type="date"
                  defaultValue={r.chequeVencimiento}
                  disabled={r.tipo !== "pago"}
                  className="excel-cell-input w-full border-0 bg-transparent px-1 py-1.5 font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset disabled:opacity-50"
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== r.chequeVencimiento) void patchRow(r.id, { chequeVencimiento: v || null });
                  }}
                />
              </td>
              <td className={`border-r border-slate-100 p-0 ${mobileExtraColsClass}`}>
                <input
                  type="date"
                  defaultValue={r.fechaRecepcion}
                  disabled={r.tipo !== "pago"}
                  className="excel-cell-input w-full border-0 bg-transparent px-1 py-1.5 font-mono text-xs focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset disabled:opacity-50"
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== r.fechaRecepcion) void patchRow(r.id, { fechaRecepcion: v || null });
                  }}
                />
              </td>
            </>
          )}
          <td className="border-r border-slate-100 p-0">
            <select
              defaultValue={r.tipo}
              disabled={r.tipo === "venta" && !!r.archivoId}
              title={
                r.tipo === "venta" && r.archivoId
                  ? "Las ventas desde PDF no cambian de tipo aquí"
                  : undefined
              }
              className="w-full cursor-pointer border-0 bg-transparent px-2 py-1.5 text-xs capitalize focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset disabled:cursor-not-allowed disabled:opacity-70"
              onChange={(e) => void patchRow(r.id, { tipo: e.target.value })}
            >
              {tipoOpcionesFila(r).map((t) => (
                <option key={t} value={t}>
                  {t}
                  {t === "devolucion" || t === "ajuste" ? " (hist.)" : ""}
                </option>
              ))}
            </select>
          </td>
          <td className="border-r border-slate-100 p-0 align-top">
            <textarea
              defaultValue={r.descripcion}
              rows={2}
              className="excel-cell-input min-h-[3rem] w-full resize-y break-words border-0 bg-transparent px-2 py-2 text-xs leading-snug focus:bg-white focus:ring-2 focus:ring-emerald-500/25 focus:ring-inset"
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== r.descripcion) void patchRow(r.id, { descripcion: v });
              }}
            />
            {r.tipo === "venta" && r.liquidadoAt ? (
              <div className="px-2 pb-2">
                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/70 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600/60">
                  PAGADA
                </span>
              </div>
            ) : null}
            {r.tipo === "venta" &&
            !r.liquidadoAt &&
            (r.saldoPendiente ?? r.total) > 0 &&
            (r.saldoPendiente ?? r.total) < r.total ? (
              <div className="px-2 pb-1">
                <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/50">
                  Parcial · pendiente {formatMoneda(r.saldoPendiente ?? r.total)}
                </span>
              </div>
            ) : null}
            {r.tipo === "venta" && !r.liquidadoAt && (r.saldoPendiente ?? r.total) > 0 ? (
              <div className="px-2 pb-2">
                <button
                  type="button"
                  className="btn-tertiary h-7 px-2 py-0 text-[0.65rem]"
                  onClick={() => {
                    setMarcarPagoMedio("efectivo");
                    setMarcarPagoChequeBanco("");
                    setMarcarPagoChequeNumero("");
                    setMarcarPagoChequeVencimiento("");
                    setMarcarPagoFechaRecepcion("");
                    setMarcarPagoRow(r);
                  }}
                  title={
                    r.archivoId
                      ? "Registrar pago solo de esta línea (PDF). Elegí el medio de pago en el panel inferior."
                      : "Registrar pago solo de esta línea. Para cheque u otros medios usá Cargar pago."
                  }
                >
                  Marcar pagada
                </button>
              </div>
            ) : null}
          </td>
          {showNotasCols ? (
            <td className="border-r border-slate-100 p-0 align-top">
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
          <td className="w-20 border-r border-slate-100 p-0">
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
          <td className="w-24 border-r border-slate-100 p-0">
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
          <td className="border-r border-slate-100 p-2 text-right font-mono text-xs tabular-nums text-slate-800">
            {formatMoneda(r.total)}
          </td>
          <td className="p-1.5 text-right align-middle">
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                className="rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-50 hover:text-slate-700 group-hover:opacity-100"
                title="Ver historial de cambios"
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `/api/audit/cambios?entidad=movimiento&entidadId=${encodeURIComponent(r.id)}`,
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
              {rowErr ? (
                <span
                  className="max-w-[16rem] truncate text-[0.65rem] font-medium text-rose-700"
                  title={rowErr}
                >
                  Error al guardar
                </span>
              ) : null}
              {savingId === r.id ? (
                <span className="text-[0.65rem] text-slate-400">Guardando…</span>
              ) : savedId === r.id ? (
                <span className="inline-flex items-center gap-0.5 text-emerald-700" title="Guardado">
                  <IconCheck className="size-3.5" />
                </span>
              ) : null}
              {canDeleteMov && deleteConfirmId === r.id ? (
                <div className="flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-1 ring-1 ring-rose-200/70">
                  <span className="text-[0.65rem] font-medium text-rose-800">¿Eliminar?</span>
                  <button
                    type="button"
                    className="rounded-md bg-rose-600 px-2 py-1 text-[0.65rem] font-semibold text-white hover:bg-rose-700"
                    onClick={async () => {
                      const res = await fetch(`/api/movimientos/${r.id}`, { method: "DELETE" });
                      if (res.ok) {
                        setRows((prev) => prev.filter((x) => x.id !== r.id));
                      }
                      setDeleteConfirmId(null);
                    }}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-[0.65rem] font-semibold text-slate-600 hover:bg-white"
                    onClick={() => setDeleteConfirmId(null)}
                  >
                    No
                  </button>
                </div>
              ) : canDeleteMov ? (
                <button
                  type="button"
                  className="rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  title="Eliminar fila"
                  onClick={() => setDeleteConfirmId(r.id)}
                >
                  <IconTrash className="size-4" />
                </button>
              ) : null}
            </div>
          </td>
        </tr>
      );
    }

    const cargaHref =
      todoCliente || sinObra
        ? `/dashboard/carga?clienteId=${clienteId}`
        : `/dashboard/carga?clienteId=${clienteId}&obraId=${obraId}`;

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label-field">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="input-app w-auto min-w-[10rem]"
              />
            </div>
            <div>
              <label className="label-field">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="input-app w-auto min-w-[10rem]"
              />
            </div>
            <div>
              <label className="label-field">Tipo</label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="select-app min-w-[9rem]"
              >
                <option value="">Todos</option>
                {TIPOS_FILTRO.map((t) => (
                  <option key={t} value={t} className="capitalize">
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => void load()} className="btn-secondary">
              Aplicar
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200/80"
              title={
                rows.length
                  ? "Recalculado con filas visibles"
                  : sinObra
                    ? "Solo movimientos sin obra"
                    : todoCliente
                      ? "Todos los movimientos del cliente"
                      : "Saldo total obra"
              }
            >
              <span className="text-slate-500">
                {sinObra ? "Saldo sin obra " : todoCliente ? "Saldo cliente " : "Saldo obra "}
              </span>
              {loading && rows.length === 0 ? (
                <strong className="font-mono tabular-nums text-slate-400">—</strong>
              ) : (
                <strong
                  className={`font-mono tabular-nums ${
                    (rows.length ? saldoActual : saldoInicial) > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {formatMoneda(rows.length ? saldoActual : saldoInicial)}
                </strong>
              )}
              {rows.length && saldoActual !== saldoLive ? (
                <span className="ml-2 text-xs text-slate-500">
                  (Total bruto:{" "}
                  <span className="font-mono tabular-nums">{formatMoneda(saldoLive)}</span>)
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setShowChequeCols((v) => !v)}
              className={`btn-secondary text-sm ${showChequeCols ? "ring-2 ring-amber-200/80" : ""}`}
              title="Datos de cheque (medio, número, vencimiento, recepción)"
            >
              {showChequeCols ? "Ocultar datos de cheque" : "Mostrar datos de cheque"}
            </button>
            <button
              type="button"
              onClick={() => setShowExtraMobileCols((v) => !v)}
              className="btn-secondary text-sm xl:hidden"
              title="Columnas extra en mobile"
            >
              {showExtraMobileCols ? "Mostrar menos" : "Mostrar más"}
            </button>
            <button
              type="button"
              onClick={() => setShowNotasCols((v) => !v)}
              className={`btn-secondary text-sm ${showNotasCols ? "ring-2 ring-emerald-200/80" : ""}`}
              title="Notas por fila"
            >
              {showNotasCols ? "Ocultar notas" : "Mostrar notas"}
            </button>
            {!sinObra ? (
              <Link
                href={cargaHref}
                className="btn-primary text-sm"
                title="Registrar cobro del cliente (efectivo, transferencia, tarjeta o cheque)"
              >
                Registrar movimiento
              </Link>
            ) : null}
            {!sinObra ? (
              <button
                type="button"
                className="btn-secondary text-sm"
                title="Registrar un cobro e imputarlo a una o varias ventas con montos parciales"
                onClick={() => setModalPagoParcialOpen(true)}
              >
                Pago parcial / imputar
              </button>
            ) : null}
          </div>
        </div>

        <ModalAplicarPago
          open={modalPagoParcialOpen}
          onClose={() => setModalPagoParcialOpen(false)}
          clienteId={clienteId}
          obraId={obraIdParaPago}
          ventasPendientes={ventasPendientesModal}
          onSuccess={load}
        />

        {marcarPagoRow ? (
          <div
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-sm dark:border-amber-800/50 dark:bg-amber-950/30"
            role="region"
            aria-label="Confirmar marcar venta como pagada"
          >
            <span className="font-medium text-amber-950 dark:text-amber-100">
              Marcar pagada · {formatMoneda(marcarPagoRow.saldoPendiente ?? marcarPagoRow.total)}
              {marcarPagoRow.comprobante ? (
                <span className="ml-1 font-mono text-xs text-amber-900/90 dark:text-amber-200/90">
                  ({marcarPagoRow.comprobante})
                </span>
              ) : null}
            </span>
            <select
              value={marcarPagoMedio}
              onChange={(e) =>
                setMarcarPagoMedio(
                  e.target.value as
                    | "efectivo"
                    | "transferencia"
                    | "cheque"
                    | "tarjeta_debito"
                    | "tarjeta_credito",
                )
              }
              className="select-app h-8 py-0 text-xs"
              aria-label="Medio de pago"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta_debito">Tarjeta débito</option>
              <option value="tarjeta_credito">Tarjeta crédito</option>
              <option value="cheque">Cheque</option>
            </select>
            {marcarPagoMedio === "cheque" ? (
              <>
                <input
                  className="input-app h-8 min-w-[8rem] py-0 text-xs"
                  placeholder="Banco"
                  value={marcarPagoChequeBanco}
                  onChange={(e) => setMarcarPagoChequeBanco(e.target.value)}
                />
                <input
                  className="input-app h-8 min-w-[8rem] py-0 text-xs"
                  placeholder="N° cheque"
                  value={marcarPagoChequeNumero}
                  onChange={(e) => setMarcarPagoChequeNumero(e.target.value)}
                />
                <input
                  type="date"
                  className="input-app h-8 py-0 text-xs"
                  value={marcarPagoChequeVencimiento}
                  onChange={(e) => setMarcarPagoChequeVencimiento(e.target.value)}
                />
                <input
                  type="date"
                  className="input-app h-8 py-0 text-xs"
                  value={marcarPagoFechaRecepcion}
                  onChange={(e) => setMarcarPagoFechaRecepcion(e.target.value)}
                />
              </>
            ) : null}
            <button
              type="button"
              className="btn-primary h-8 px-3 text-xs"
              disabled={marcarPagoLoading}
              onClick={() => void confirmMarcarPagoDesdeGrilla()}
            >
              {marcarPagoLoading ? "Registrando…" : "Confirmar"}
            </button>
            <button
              type="button"
              className="btn-ghost h-8 px-2 text-xs"
              disabled={marcarPagoLoading}
              onClick={() => setMarcarPagoRow(null)}
            >
              Cancelar
            </button>
          </div>
        ) : null}

        {err && (
          <p className="alert-error" role="alert">
            {err}
          </p>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span
              className="inline-block size-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"
              aria-hidden
            />
            Cargando movimientos…
          </div>
        ) : (
          <div className="table-shell max-w-full excel-scroll">
            <table className="excel-table w-full min-w-full max-w-full border-collapse text-xs md:min-w-[44rem] lg:table-fixed">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-36 xl:w-40">
                    Fecha
                  </th>
                  <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-40 xl:w-44">
                    Comprobante
                  </th>
                  {showChequeCols && (
                    <>
                      <th
                        className={`border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-24 ${mobileExtraColsClass}`}
                      >
                        Medio
                      </th>
                      <th
                        className={`border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-24 ${mobileExtraColsClass}`}
                      >
                        Nº ch.
                      </th>
                      <th
                        className={`border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-32 ${mobileExtraColsClass}`}
                      >
                        Vto. ch.
                      </th>
                      <th
                        className={`border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-32 ${mobileExtraColsClass}`}
                      >
                        Recibido
                      </th>
                    </>
                  )}
                  <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-32">
                    Tipo
                  </th>
                  <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:min-w-0 lg:w-[34%]">
                    Descripción
                  </th>
                  {showNotasCols ? (
                    <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200">
                      Notas
                    </th>
                  ) : null}
                  <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-20">
                    Cant.
                  </th>
                  <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-24">
                    P. unit.
                  </th>
                  <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 border-r border-slate-200 lg:w-28">
                    Total
                  </th>
                  <th className="border-b border-slate-200 bg-slate-50 p-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 lg:w-16 last:border-r-0">
                    {" "}
                  </th>
                </tr>
              </thead>
              <tbody>
                {segments.flatMap((seg, si) =>
                  seg.kind === "single"
                    ? seg.rows.map((r) => renderRow(r))
                    : [
                        <tr
                          key={`g-${si}`}
                          className="border-b border-slate-200/80 bg-slate-100/95 text-xs font-medium text-slate-800"
                        >
                          <td colSpan={colCount} className="px-3 py-2">
                            <span className="font-mono text-[0.7rem] text-slate-600">
                              {seg.labelComp}
                            </span>
                            <span className="mx-2 text-slate-300">·</span>
                            <span>{formatFechaCorta(seg.labelFecha)}</span>
                            <span className="mx-2 text-slate-300">·</span>
                            Total{" "}
                            <span className="font-mono tabular-nums text-slate-900">
                              {formatMoneda(seg.total)}
                            </span>
                          </td>
                        </tr>,
                        ...seg.rows.map((r) => renderRow(r)),
                      ],
                )}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="py-12 text-center text-slate-500">
                      Sin movimientos en este rango.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
}
