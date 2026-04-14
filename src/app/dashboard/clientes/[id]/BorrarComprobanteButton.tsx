"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BorrarComprobanteButton({ archivoId }: { archivoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onBorrar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/archivos/${encodeURIComponent(archivoId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo borrar");
      router.refresh();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={loading}
        className="btn-ghost btn-danger-ghost text-sm disabled:opacity-50"
      >
        {loading ? "…" : "Borrar"}
      </button>
      <ConfirmModal
        open={open}
        title="Eliminar comprobante"
        description={`¿Eliminar este comprobante?\n\nSe borra el PDF y todas las ventas importadas desde ese archivo. Si había un cobro «marcar pagado» solo de ese comprobante, el cobro se conserva en el historial de pagos del cliente pero deja de contar como saldo a favor (no genera anticipo en cartera). No se puede deshacer.${error ? `\n\nError: ${error}` : ""}`}
        confirmLabel="Confirmar eliminación"
        loading={loading}
        onCancel={() => setOpen(false)}
        onConfirm={() => void onBorrar()}
      />
    </>
  );
}
