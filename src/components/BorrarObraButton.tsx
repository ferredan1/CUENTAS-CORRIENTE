"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  obraId: string;
  nombre: string;
  clienteId: string;
  /** Desde la ficha del cliente solo refrescamos; desde la vista de la obra volvemos a la ficha del cliente. */
  alExito?: "refrescar" | "ir-ficha-cliente";
  className?: string;
  etiqueta?: string;
};

export function BorrarObraButton({
  obraId,
  nombre,
  clienteId,
  alExito = "ir-ficha-cliente",
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
      const res = await fetch(`/api/obras/${encodeURIComponent(obraId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo borrar");
      if (alExito === "ir-ficha-cliente") {
        router.push(`/dashboard/clientes/${encodeURIComponent(clienteId)}`);
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
        {loading ? "…" : (etiqueta ?? "Eliminar obra")}
      </button>
      <ConfirmModal
        open={open}
        title="Eliminar obra"
        description={`¿Eliminar la obra «${nombre}»?\n\nSe borrarán todos los movimientos de esa obra, los comprobantes PDF guardados para la obra y las ventas importadas desde esos PDF. No se puede deshacer.${error ? `\n\nError: ${error}` : ""}`}
        confirmLabel="Confirmar eliminación"
        loading={loading}
        onCancel={() => setOpen(false)}
        onConfirm={() => void onBorrar()}
      />
    </>
  );
}
