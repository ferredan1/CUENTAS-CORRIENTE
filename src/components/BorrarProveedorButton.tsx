"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  proveedorId: string;
  nombre: string;
  alExito?: "ir-listado" | "refrescar";
  className?: string;
  etiqueta?: string;
};

export function BorrarProveedorButton({
  proveedorId,
  nombre,
  alExito = "ir-listado",
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
      const res = await fetch(`/api/proveedores/${encodeURIComponent(proveedorId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo borrar");
      if (alExito === "ir-listado") router.push("/dashboard/proveedores");
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
        {loading ? "…" : (etiqueta ?? "Eliminar proveedor")}
      </button>
      <ConfirmModal
        open={open}
        title="Eliminar proveedor"
        description={`¿Eliminar al proveedor «${nombre}»?\n\nSe borran también sus movimientos y archivos asociados. No se puede deshacer.${error ? `\n\nError: ${error}` : ""}`}
        confirmLabel="Confirmar eliminación"
        loading={loading}
        onCancel={() => setOpen(false)}
        onConfirm={() => void onBorrar()}
      />
    </>
  );
}

