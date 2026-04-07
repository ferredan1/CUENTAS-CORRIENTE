"use client";

import { signalPagoCargadoFlash } from "@/components/dashboard/PagoCargadoFlash";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type MedioPagoInline = "efectivo" | "transferencia";

function ymdHoyLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function PagoInlineResumenClient({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [medioPago, setMedioPago] = useState<MedioPagoInline>("efectivo");
  const [monto, setMonto] = useState<string>("");
  const [fecha, setFecha] = useState<string>(() => ymdHoyLocal());
  const [loading, setLoading] = useState(false);

  const montoNumero = useMemo(() => {
    const n = Number(String(monto).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }, [monto]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      alert("Indicá un monto válido.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/pagos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          clienteId,
          fecha: fecha ? `${fecha}T12:00:00` : undefined,
          monto: montoNumero,
          medioPago,
          descripcion: `Pago (${medioPago})`,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "No se pudo guardar el pago");
      setMonto("");
      setOpen(false);
      signalPagoCargadoFlash();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
          Cargar pago rápido
        </p>
        <button type="button" className="btn-ghost text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      {open ? (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-3 grid gap-2 sm:grid-cols-6">
          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Medio</span>
            <select
              className="input mt-1 w-full"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value as MedioPagoInline)}
              disabled={loading}
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Fecha</span>
            <input
              className="input mt-1 w-full"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={loading}
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Monto</span>
            <input
              className="input mt-1 w-full"
              inputMode="decimal"
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              disabled={loading}
            />
          </label>

          <div className="sm:col-span-6 flex flex-wrap items-center justify-between gap-2 pt-1">
            <Link
              href={`/dashboard/carga?clienteId=${encodeURIComponent(clienteId)}`}
              className="link-app text-xs"
            >
              ¿Cheque? Usá el formulario completo →
            </Link>
            <button type="submit" className="btn-primary text-sm" disabled={loading}>
              {loading ? "Guardando…" : "Guardar pago"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          Para cheques, usá “Cargar pago” (formulario completo).
        </p>
      )}
    </div>
  );
}

