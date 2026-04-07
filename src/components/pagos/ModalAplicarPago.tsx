"use client";

import { signalPagoCargadoFlash } from "@/components/dashboard/PagoCargadoFlash";
import { formatMoneda } from "@/lib/format";
import { useCallback, useEffect, useMemo, useState } from "react";

export type VentaPendienteModal = {
  id: string;
  comprobante: string | null;
  total: number;
  saldoPendiente: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  obraId: string | null;
  ventasPendientes: VentaPendienteModal[];
  onSuccess: () => void | Promise<void>;
};

export function ModalAplicarPago({ open, onClose, clienteId, obraId, ventasPendientes, onSuccess }: Props) {
  const [importeTotal, setImporteTotal] = useState("");
  const [medioPago, setMedioPago] = useState<"efectivo" | "transferencia">("efectivo");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [comprobantePago, setComprobantePago] = useState("");
  const [importesPorVenta, setImportesPorVenta] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setImporteTotal("");
    setComprobantePago("");
    setFecha(new Date().toISOString().slice(0, 10));
    setMedioPago("efectivo");
    const init: Record<string, string> = {};
    for (const v of ventasPendientes) init[v.id] = "";
    setImportesPorVenta(init);
  }, [open, ventasPendientes]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sumaAplicaciones = useMemo(() => {
    let s = 0;
    for (const v of ventasPendientes) {
      const raw = importesPorVenta[v.id]?.trim() ?? "";
      if (raw === "") continue;
      const n = Number(raw.replace(",", "."));
      if (Number.isFinite(n) && n > 0) s += n;
    }
    return Math.round(s * 100) / 100;
  }, [ventasPendientes, importesPorVenta]);

  const totalNum = useMemo(() => {
    const n = Number(String(importeTotal).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }, [importeTotal]);

  const validar = useCallback(() => {
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      return "Indicá un importe total del pago mayor a cero.";
    }
    if (sumaAplicaciones <= 0) {
      return "Distribuí el importe en al menos una venta pendiente.";
    }
    if (sumaAplicaciones > totalNum + 0.001) {
      return "La suma imputada no puede superar el importe total del pago.";
    }
    for (const v of ventasPendientes) {
      const raw = importesPorVenta[v.id]?.trim() ?? "";
      if (raw === "") continue;
      const n = Number(raw.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) return `Importe inválido en comprobante ${v.comprobante ?? v.id}.`;
      if (n > v.saldoPendiente + 0.001) {
        return `En ${v.comprobante ?? v.id} el importe supera el saldo pendiente (${formatMoneda(v.saldoPendiente)}).`;
      }
    }
    return null;
  }, [totalNum, sumaAplicaciones, ventasPendientes, importesPorVenta]);

  async function submit() {
    const msg = validar();
    if (msg) {
      setError(msg);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const aplicaciones: { movimientoId: string; importeAplicado: number }[] = [];
      for (const v of ventasPendientes) {
        const raw = importesPorVenta[v.id]?.trim() ?? "";
        if (raw === "") continue;
        const n = Math.round(Number(raw.replace(",", ".")) * 100) / 100;
        if (n > 0) aplicaciones.push({ movimientoId: v.id, importeAplicado: n });
      }
      const fechaIso = new Date(`${fecha}T12:00:00`).toISOString();
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          version: 2,
          clienteId,
          obraId,
          fecha: fechaIso,
          importeTotal: totalNum,
          medioPago,
          comprobante: comprobantePago.trim() || null,
          descripcion: `Pago imputado (${aplicaciones.length} venta${aplicaciones.length === 1 ? "" : "s"})`,
          aplicaciones,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "No se pudo registrar el pago");
      signalPagoCargadoFlash();
      await onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Pago con imputación parcial</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          La suma imputada no puede superar el importe total del pago. Si el cobro es mayor, quedará saldo en el pago
          para imputar luego desde otra operación.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field">Importe total del pago</label>
            <input
              className="input-app w-full font-mono tabular-nums"
              inputMode="decimal"
              value={importeTotal}
              onChange={(e) => setImporteTotal(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="label-field">Fecha</label>
            <input
              type="date"
              className="input-app w-full"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="label-field">Medio</label>
            <select
              className="select-app w-full"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value as "efectivo" | "transferencia")}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          <div>
            <label className="label-field">Comprobante de pago (opc.)</label>
            <input
              className="input-app w-full"
              value={comprobantePago}
              onChange={(e) => setComprobantePago(e.target.value)}
              placeholder="Recibo / transferencia"
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imputar a ventas pendientes</p>
          {ventasPendientes.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No hay ventas con saldo pendiente en esta vista.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {ventasPendientes.map((v) => (
                <li
                  key={v.id}
                  className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                      {v.comprobante ?? "Sin comprobante"}
                    </span>
                    <div className="text-[0.65rem] text-slate-500">
                      Pendiente:{" "}
                      <span className="font-mono tabular-nums">{formatMoneda(v.saldoPendiente)}</span>
                      {v.total !== v.saldoPendiente ? (
                        <span className="ml-1">· Total factura {formatMoneda(v.total)}</span>
                      ) : null}
                    </div>
                  </div>
                  <input
                    className="input-app h-9 w-full max-w-[8rem] font-mono text-sm tabular-nums sm:text-right"
                    inputMode="decimal"
                    placeholder="0"
                    value={importesPorVenta[v.id] ?? ""}
                    onChange={(e) =>
                      setImportesPorVenta((prev) => ({ ...prev, [v.id]: e.target.value }))
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span>
            Suma imputada:{" "}
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatMoneda(sumaAplicaciones)}
            </span>
          </span>
          {Number.isFinite(totalNum) && totalNum > 0 ? (
            <span>
              Restante sin imputar en esta carga:{" "}
              <span className="font-mono tabular-nums">
                {formatMoneda(Math.max(0, Math.round((totalNum - sumaAplicaciones) * 100) / 100))}
              </span>
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="alert-error mt-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" disabled={loading || ventasPendientes.length === 0} onClick={() => void submit()}>
            {loading ? "Registrando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
