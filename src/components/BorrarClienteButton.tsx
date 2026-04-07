"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  clienteId: string;
  nombre: string;
  saldo?: number;
  /** En la ficha del cliente volvemos al panel; en el listado solo refrescamos la página actual. */
  alExito?: "ir-panel" | "refrescar";
  className?: string;
  etiqueta?: string;
};

export function BorrarClienteButton({
  clienteId,
  nombre,
  saldo,
  alExito = "ir-panel",
  className,
  etiqueta,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onBorrar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(clienteId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo borrar");
      if (alExito === "ir-panel") {
        router.push("/dashboard");
      }
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
        className={
          className ??
          "btn-ghost btn-danger-ghost border border-rose-200/80 bg-rose-50/50 text-sm hover:bg-rose-100/80 disabled:opacity-50"
        }
      >
        {loading ? "…" : (etiqueta ?? "Eliminar cliente")}
      </button>
      <ConfirmModal
        open={open}
        title={`Eliminar cliente`}
        description={`¿Eliminar al cliente «${nombre}»?\n\nSe borran también todas sus obras, movimientos de cuenta corriente y comprobantes PDF guardados. No se puede deshacer.${
          typeof saldo === "number" && saldo > 0 ? `\n\nATENCIÓN: saldo a cobrar: ${saldo.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}.` : ""
        }${error ? `\n\nError: ${error}` : ""}`}
        confirmLabel="Confirmar eliminación"
        loading={loading}
        onCancel={() => setOpen(false)}
        onConfirm={() => void onBorrar()}
      />
    </>
  );
}
