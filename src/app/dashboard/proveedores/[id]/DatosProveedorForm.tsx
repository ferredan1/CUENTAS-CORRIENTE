"use client";

import { validarCuit } from "@/lib/cuit";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  proveedorId: string;
  nombre: string;
  razonSocial: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  condicionIva: string | null;
  notas: string | null;
};

export function DatosProveedorForm({
  proveedorId,
  nombre: nombreInicial,
  razonSocial: razonInicial,
  cuit: cuitInicial,
  email: emailInicial,
  telefono: telInicial,
  condicionIva: ivaInicial,
  notas: notasInicial,
}: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [razonSocial, setRazonSocial] = useState(razonInicial ?? "");
  const [cuit, setCuit] = useState(cuitInicial ?? "");
  const [email, setEmail] = useState(emailInicial ?? "");
  const [telefono, setTelefono] = useState(telInicial ?? "");
  const [condicionIva, setCondicionIva] = useState(ivaInicial ?? "");
  const [notas, setNotas] = useState(notasInicial ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cuitInvalido = Boolean(cuit.trim()) && !validarCuit(cuit);

  useEffect(() => {
    setNombre(nombreInicial);
    setRazonSocial(razonInicial ?? "");
    setCuit(cuitInicial ?? "");
    setEmail(emailInicial ?? "");
    setTelefono(telInicial ?? "");
    setCondicionIva(ivaInicial ?? "");
    setNotas(notasInicial ?? "");
  }, [nombreInicial, razonInicial, cuitInicial, emailInicial, telInicial, ivaInicial, notasInicial]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (cuitInvalido) {
      setErr("CUIT inválido. Revisá el número (11 dígitos con dígito verificador).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/proveedores/${encodeURIComponent(proveedorId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          razonSocial: razonSocial.trim() || null,
          cuit: cuit.trim() || null,
          email: email.trim() || null,
          telefono: telefono.trim() || null,
          condicionIva: condicionIva.trim() || null,
          notas: notas.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error");
      setOk("Datos guardados.");
      router.refresh();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-900">Datos del proveedor</h2>
        <p className="mt-1 text-xs text-slate-500">Identificación y datos de contacto / fiscal.</p>
      </div>

      <fieldset className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">Identificación</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-field">Nombre</label>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="input-app" />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Razón social</label>
            <input
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Opcional"
              className="input-app"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">Contacto y fiscal</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">CUIT</label>
            <input
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              placeholder="Ej. 30-12345678-9"
              className="input-app"
              inputMode="numeric"
              autoComplete="off"
            />
            {cuitInvalido ? (
              <p className="mt-1 text-xs font-medium text-rose-700">
                CUIT inválido (verificá el dígito final).
              </p>
            ) : null}
          </div>
          <div>
            <label className="label-field">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-app"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label-field">Teléfono</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="input-app"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          <div>
            <label className="label-field">Condición IVA</label>
            <select value={condicionIva} onChange={(e) => setCondicionIva(e.target.value)} className="select-app">
              <option value="">—</option>
              <option value="RI">Responsable Inscripto</option>
              <option value="Monotributo">Monotributo</option>
              <option value="Exento">Exento</option>
              <option value="CF">Consumidor Final</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="input-app min-h-28"
              placeholder="Opcional"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Guardando…" : "Guardar datos"}
        </button>
        {ok && (
          <p className="text-sm text-emerald-800" role="status">
            {ok}
          </p>
        )}
      </div>
      {err && (
        <p className="alert-error text-sm" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}

