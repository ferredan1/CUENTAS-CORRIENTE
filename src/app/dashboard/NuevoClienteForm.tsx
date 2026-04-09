"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Props = {
  variant?: "default" | "compact";
  /** Sin caja `card` (uso dentro de `CenteredFormModal`). */
  embeddedInModal?: boolean;
  onCreated?: () => void;
};

export function NuevoClienteForm({ variant = "default", embeddedInModal = false, onCreated }: Props) {
  const router = useRouter();
  const contactoRef = useRef<HTMLDetailsElement>(null);
  const [nombre, setNombre] = useState("");
  const [nombrePersona, setNombrePersona] = useState("");
  const [apellido, setApellido] = useState("");
  const [cuit, setCuit] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          tipo: "particular",
          nombrePersona: nombrePersona.trim() || null,
          apellido: apellido.trim() || null,
          cuit: cuit.trim() || null,
          email: email.trim() || null,
          telefono: telefono.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error");
      setNombre("");
      setNombrePersona("");
      setApellido("");
      setCuit("");
      setEmail("");
      setTelefono("");
      onCreated?.();
      router.refresh();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const compact = variant === "compact";

  const formClass = embeddedInModal ? "space-y-3" : "card-compact space-y-3";

  return (
    <form onSubmit={onSubmit} className={formClass}>
      {!compact && (
        <p className="text-[0.7rem] text-slate-500">
          Solo nombre y tipo para crear; el resto puede ir después en la ficha.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className={`min-w-[180px] flex-1 ${compact ? "max-w-md" : "min-w-[200px]"}`}>
          <label className="label-field">Nombre / razón social</label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Obra Central, S.A."
            className="input-app"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary shrink-0">
          {loading ? "Guardando…" : compact ? "Crear" : "Crear cliente"}
        </button>
      </div>
      {compact && (
        <p className="text-xs">
          <button
            type="button"
            className="text-emerald-800 underline-offset-2 hover:underline"
            onClick={() => {
              const el = contactoRef.current;
              if (el) {
                el.open = true;
                el.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
            }}
          >
            Agregar datos de contacto
          </button>
          <span className="text-slate-400"> · opcional</span>
        </p>
      )}
      <details
        ref={contactoRef}
        id="contacto-rapido"
        className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm"
      >
        <summary className="cursor-pointer list-none font-medium text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
          + Datos de contacto y facturación{" "}
          <span className="font-normal text-slate-400">(opcional)</span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field">Nombre</label>
            <input
              value={nombrePersona}
              onChange={(e) => setNombrePersona(e.target.value)}
              className="input-app"
            />
          </div>
          <div>
            <label className="label-field">Apellido</label>
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className="input-app"
            />
          </div>
          <div>
            <label className="label-field">CUIT / CUIL</label>
            <input
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              className="input-app"
            />
          </div>
          <div>
            <label className="label-field">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-app"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Teléfono</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="input-app"
            />
          </div>
        </div>
      </details>
      {err && (
        <p className="alert-error w-full basis-full" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
