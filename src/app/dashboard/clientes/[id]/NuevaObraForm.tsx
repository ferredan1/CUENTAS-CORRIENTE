"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NuevaObraForm({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/obras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, nombre }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error");
      setNombre("");
      router.refresh();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-compact flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <label className="label-field">Nueva obra</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de obra o frente"
          className="input-app"
          required
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary shrink-0">
        {loading ? "…" : "Agregar obra"}
      </button>
      {err && (
        <p className="alert-error w-full basis-full text-xs" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
