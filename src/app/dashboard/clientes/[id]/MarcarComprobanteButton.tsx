"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarcarComprobanteButton({ archivoId }: { archivoId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "loading">("idle");
  const [medioPago, setMedioPago] = useState<
    "efectivo" | "transferencia" | "cheque" | "tarjeta_debito" | "tarjeta_credito"
  >("efectivo");
  const [chequeBanco, setChequeBanco] = useState("");
  const [chequeNumero, setChequeNumero] = useState("");
  const [chequeVencimiento, setChequeVencimiento] = useState("");
  const [fechaRecepcion, setFechaRecepcion] = useState("");

  async function onConfirmar() {
    setStep("loading");
    try {
      const res = await fetch(`/api/archivos/${archivoId}/liquidar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          medioPago,
          chequeBanco: medioPago === "cheque" ? chequeBanco : null,
          chequeNumero: medioPago === "cheque" ? chequeNumero : null,
          chequeVencimiento: medioPago === "cheque" ? chequeVencimiento : null,
          fechaRecepcion: medioPago === "cheque" ? fechaRecepcion : null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Error");
      }
      setStep("idle");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
      setStep("confirm");
    }
  }

  if (step === "idle") {
    return (
      <button type="button" className="btn-ghost text-xs" onClick={() => setStep("confirm")}>
        Marcar pagado
      </button>
    );
  }

  if (step === "loading") {
    return <span className="text-xs text-slate-400">Registrando…</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
        className="select-app h-7 py-0 text-xs"
      >
        <option value="efectivo">Efectivo</option>
        <option value="transferencia">Transferencia</option>
        <option value="tarjeta_debito">Tarjeta débito</option>
        <option value="tarjeta_credito">Tarjeta crédito</option>
        <option value="cheque">Cheque</option>
      </select>
      {medioPago === "cheque" ? (
        <>
          <input
            className="input-app h-7 min-w-[8rem] py-0 text-xs"
            placeholder="Banco"
            value={chequeBanco}
            onChange={(e) => setChequeBanco(e.target.value)}
          />
          <input
            className="input-app h-7 min-w-[8rem] py-0 text-xs"
            placeholder="N° cheque"
            value={chequeNumero}
            onChange={(e) => setChequeNumero(e.target.value)}
          />
          <input
            type="date"
            className="input-app h-7 py-0 text-xs"
            value={chequeVencimiento}
            onChange={(e) => setChequeVencimiento(e.target.value)}
          />
          <input
            type="date"
            className="input-app h-7 py-0 text-xs"
            value={fechaRecepcion}
            onChange={(e) => setFechaRecepcion(e.target.value)}
          />
        </>
      ) : null}
      <button type="button" className="btn-primary h-7 px-2 text-xs" onClick={() => void onConfirmar()}>
        Confirmar
      </button>
      <button type="button" className="btn-ghost h-7 px-2 text-xs" onClick={() => setStep("idle")}>
        ×
      </button>
    </div>
  );
}
