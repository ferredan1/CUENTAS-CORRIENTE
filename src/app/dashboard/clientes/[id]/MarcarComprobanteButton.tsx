"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarcarComprobanteButton({ archivoId }: { archivoId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "loading">("idle");
  const [medioPago, setMedioPago] = useState<"efectivo" | "transferencia">("efectivo");

  async function onConfirmar() {
    setStep("loading");
    try {
      const res = await fetch(`/api/archivos/${archivoId}/liquidar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ medioPago }),
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
        onChange={(e) => setMedioPago(e.target.value as "efectivo" | "transferencia")}
        className="select-app h-7 py-0 text-xs"
      >
        <option value="efectivo">Efectivo</option>
        <option value="transferencia">Transferencia</option>
      </select>
      <button type="button" className="btn-primary h-7 px-2 text-xs" onClick={() => void onConfirmar()}>
        Confirmar
      </button>
      <button type="button" className="btn-ghost h-7 px-2 text-xs" onClick={() => setStep("idle")}>
        ×
      </button>
    </div>
  );
}
