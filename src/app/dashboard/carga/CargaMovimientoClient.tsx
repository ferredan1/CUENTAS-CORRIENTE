"use client";

import { markPagoCargadoForNextDashboardPage } from "@/components/dashboard/PagoCargadoFlash";
import { formatMoneda } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ClienteOpt = { id: string; nombre: string; saldo?: number };
type ObraOpt = { id: string; nombre: string };
type TipoCarga = "pago" | "devolucion" | "ajuste";

function ymdHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseMontoInput(raw: string): number {
  const t = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function CargaMovimientoClient({
  initialClienteId,
  initialObraId,
  initialTipo = "pago",
}: {
  initialClienteId?: string;
  initialObraId?: string;
  initialTipo?: TipoCarga;
}) {
  const router = useRouter();
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [obras, setObras] = useState<ObraOpt[]>([]);
  const [clienteId, setClienteId] = useState(initialClienteId ?? "");
  const [obraId, setObraId] = useState(initialObraId ?? "");
  const [tipo, setTipo] = useState<TipoCarga>(initialTipo);
  const [fecha, setFecha] = useState(ymdHoyLocal);
  const [medioPago, setMedioPago] = useState<
    "efectivo" | "transferencia" | "cheque" | "tarjeta_debito" | "tarjeta_credito"
  >("efectivo");
  const [chequeNumero, setChequeNumero] = useState("");
  const [chequeBanco, setChequeBanco] = useState("");
  const [chequeVencimiento, setChequeVencimiento] = useState("");
  const [fechaRecepcionCheque, setFechaRecepcionCheque] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [montoStr, setMontoStr] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/clientes");
      const data = (await res.json()) as ClienteOpt[];
      if (res.ok) setClientes(data);
    })();
  }, []);

  useEffect(() => {
    if (!clienteId) {
      setObras([]);
      setObraId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/obras?clienteId=${encodeURIComponent(clienteId)}`);
      const data = (await res.json()) as ObraOpt[] | { error?: string };
      if (cancelled) return;
      if (!res.ok) {
        setObras([]);
        setObraId("");
        return;
      }
      const list = data as ObraOpt[];
      setObras(list);
      if (list.length === 1) {
        setObraId(list[0].id);
      } else if (
        initialObraId &&
        initialClienteId === clienteId &&
        list.some((o) => o.id === initialObraId)
      ) {
        setObraId(initialObraId);
      } else {
        setObraId("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clienteId, initialClienteId, initialObraId]);

  useEffect(() => {
    if (initialClienteId) setClienteId(initialClienteId);
  }, [initialClienteId]);

  const saldoClienteSeleccionado = useMemo(() => {
    if (!clienteId) return null;
    const c = clientes.find((x) => x.id === clienteId);
    return c?.saldo != null ? c.saldo : null;
  }, [clienteId, clientes]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const montoNum = parseMontoInput(montoStr);
    if (!Number.isFinite(montoNum)) {
      setErr("Indicá un importe válido.");
      return;
    }
    if ((tipo === "pago" || tipo === "devolucion") && montoNum <= 0) {
      setErr("El importe debe ser mayor a cero.");
      return;
    }
    if (tipo === "ajuste" && montoNum === 0) {
      setErr("El ajuste no puede ser 0.");
      return;
    }

    setLoading(true);
    try {
      const res =
        tipo === "pago"
          ? await fetch("/api/pagos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clienteId,
                obraId: obraId || null,
                fecha: new Date(`${fecha}T12:00:00`).toISOString(),
                comprobante: comprobante || null,
                descripcion: descripcion || undefined,
                monto: montoNum,
                medioPago,
                ...(medioPago === "cheque"
                  ? {
                      chequeNumero: chequeNumero.trim(),
                      chequeBanco: chequeBanco.trim(),
                      chequeVencimiento: chequeVencimiento.trim(),
                      fechaRecepcion: fechaRecepcionCheque.trim(),
                    }
                  : {}),
              }),
            })
          : await fetch("/api/movimientos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                clienteId,
                obraId: obraId || null,
                tipo,
                fecha: new Date(`${fecha}T12:00:00`).toISOString(),
                comprobante: comprobante.trim() || null,
                descripcion:
                  descripcion.trim() ||
                  (tipo === "devolucion" ? "Devolución manual" : "Ajuste manual de saldo"),
                cantidad: 1,
                precioUnitario: tipo === "devolucion" ? Math.abs(montoNum) : montoNum,
              }),
            });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error");
      if (tipo === "pago") markPagoCargadoForNextDashboardPage();
      if (obraId) router.push(`/dashboard/obras/${obraId}`);
      else if (clienteId) router.push(`/dashboard/clientes/${clienteId}`);
      else router.push("/dashboard");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-6">
      <div>
        <p className="section-title mb-3">1 · Tipo, cliente, obra, fecha e importe</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-field">Tipo de movimiento</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoCarga)}
              className="select-app w-full"
            >
              <option value="pago">Pago</option>
              <option value="devolucion">Devolución</option>
              <option value="ajuste">Ajuste</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Devolución resta saldo. Ajuste puede sumar o restar según el signo del importe.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="label-field">Cliente</label>
            <select
              required
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                setObraId("");
              }}
              className="select-app w-full"
            >
              <option value="">Seleccionar…</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {saldoClienteSeleccionado != null ? (
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                Saldo actual del cliente:{" "}
                <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                  {formatMoneda(saldoClienteSeleccionado)}
                </span>
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label className="label-field">Obra</label>
            {!clienteId ? (
              <p className="mt-1 text-sm text-slate-500">Elegí un cliente primero.</p>
            ) : obras.length === 0 ? (
              <p className="mt-1 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                Este cliente no tiene obras: el pago se registra a nivel cliente.
              </p>
            ) : (
              <select value={obraId} onChange={(e) => setObraId(e.target.value)} className="select-app w-full">
                <option value="">Sin obra (solo cliente)</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            )}
            {obras.length === 1 ? (
              <p className="mt-1 text-xs text-slate-500">Solo hay una obra: quedó seleccionada automáticamente.</p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="label-field">Fecha de imputación</label>
                <input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="input-app w-full"
                />
              </div>
              <button
                type="button"
                className="btn-secondary mb-0.5 shrink-0 text-sm"
                onClick={() => setFecha(ymdHoyLocal())}
              >
                Hoy
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Por defecto es la fecha de hoy; podés cambiarla si el cobro fue otro día.</p>
          </div>

          <div>
            <label className="label-field">
              {tipo === "pago"
                ? "Importe del pago"
                : tipo === "devolucion"
                  ? "Importe de la devolución"
                  : "Importe del ajuste"}
            </label>
            <input
              className="input-app w-full font-mono tabular-nums"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={montoStr}
              onChange={(e) => setMontoStr(e.target.value)}
            />
            {tipo === "ajuste" ? (
              <p className="mt-1 text-xs text-slate-500">
                En ajustes podés usar signo negativo para restar saldo (ej: -1500).
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Usá coma o punto para decimales.</p>
            )}
          </div>
        </div>
      </div>

      {tipo === "pago" ? (
        <div className="space-y-4 border-t border-slate-100 pt-5">
          <p className="section-title">2 · Medio de pago</p>
          <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className="label-field">Forma de pago</label>
                <select
                  value={medioPago}
                  onChange={(e) =>
                    setMedioPago(
                      e.target.value as
                        | "efectivo"
                        | "transferencia"
                        | "cheque"
                        | "tarjeta_debito"
                        | "tarjeta_credito",
                    )
                  }
                  className="select-app capitalize"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta_debito">Tarjeta débito</option>
                  <option value="tarjeta_credito">Tarjeta crédito</option>
                </select>
              </div>
              {medioPago === "cheque" && (
                <>
                  <div className="sm:col-span-3">
                    <label className="label-field">Banco</label>
                    <input
                      required
                      value={chequeBanco}
                      onChange={(e) => setChequeBanco(e.target.value)}
                      className="input-app"
                      placeholder="Ej. Nación / Provincia / Galicia"
                    />
                  </div>
                  <div>
                    <label className="label-field">Número de cheque</label>
                    <input
                      required
                      value={chequeNumero}
                      onChange={(e) => setChequeNumero(e.target.value)}
                      className="input-app font-mono"
                      placeholder="Ej. 00012345"
                    />
                  </div>
                  <div>
                    <label className="label-field">Vencimiento del cheque</label>
                    <input
                      type="date"
                      required
                      value={chequeVencimiento}
                      onChange={(e) => setChequeVencimiento(e.target.value)}
                      className="input-app"
                    />
                  </div>
                  <div>
                    <label className="label-field">Fecha en que se recibió</label>
                    <input
                      type="date"
                      required
                      value={fechaRecepcionCheque}
                      onChange={(e) => setFechaRecepcionCheque(e.target.value)}
                      className="input-app"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-100 pt-5">
        <p className="section-title mb-3">{tipo === "pago" ? "3 · Referencia" : "2 · Referencia"}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">Comprobante</label>
            <input
              value={comprobante}
              onChange={(e) => setComprobante(e.target.value)}
              className="input-app"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="label-field">Descripción</label>
          <input
            required={tipo !== "pago" || !comprobante.trim()}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="input-app"
          />
          {comprobante.trim() && tipo === "pago" ? (
            <p className="mt-1 text-xs text-slate-500">
              Si dejás la descripción vacía, se usa «Pago comprobante {comprobante.trim()}».
            </p>
          ) : null}
        </div>
      </div>

      {tipo === "pago" && medioPago === "cheque" && (
        <p className="text-[0.7rem] text-slate-500">
          Cheque: quedan guardados número, vencimiento y recepción para seguimiento.
        </p>
      )}

      {err && (
        <p className="alert-error" role="alert">
          {err}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading
            ? "Guardando…"
            : tipo === "pago"
              ? "Guardar pago"
              : tipo === "devolucion"
                ? "Guardar devolución"
                : "Guardar ajuste"}
        </button>
      </div>
    </form>
  );
}
