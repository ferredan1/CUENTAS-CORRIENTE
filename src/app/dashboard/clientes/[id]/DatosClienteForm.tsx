"use client";

import { validarCuit } from "@/lib/cuit";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  clienteId: string;
  nombre: string;
  tipo: string;
  nombrePersona: string | null;
  apellido: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
};

export function DatosClienteForm({
  clienteId,
  nombre: nombreInicial,
  tipo: tipoInicial,
  nombrePersona: npInicial,
  apellido: apInicial,
  cuit: cuitInicial,
  email: emailInicial,
  telefono: telInicial,
}: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState(nombreInicial);
  const [tipo, setTipo] = useState(tipoInicial);
  const [nombrePersona, setNombrePersona] = useState(npInicial ?? "");
  const [apellido, setApellido] = useState(apInicial ?? "");
  const [cuit, setCuit] = useState(cuitInicial ?? "");
  const [email, setEmail] = useState(emailInicial ?? "");
  const [telefono, setTelefono] = useState(telInicial ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cuitInvalido = Boolean(cuit.trim()) && !validarCuit(cuit);

  useEffect(() => {
    setNombre(nombreInicial);
    setTipo(tipoInicial);
    setNombrePersona(npInicial ?? "");
    setApellido(apInicial ?? "");
    setCuit(cuitInicial ?? "");
    setEmail(emailInicial ?? "");
    setTelefono(telInicial ?? "");
  }, [nombreInicial, tipoInicial, npInicial, apInicial, cuitInicial, emailInicial, telInicial]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    if (cuitInvalido) {
      setErr("CUIT/CUIL inválido. Revisá el número (11 dígitos con dígito verificador).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(clienteId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          tipo,
          nombrePersona: nombrePersona.trim() || null,
          apellido: apellido.trim() || null,
          cuit: cuit.trim() || null,
          email: email.trim() || null,
          telefono: telefono.trim() || null,
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
        <h2 className="text-base font-bold text-slate-900">Datos del cliente</h2>
        <p className="mt-1 text-xs text-slate-500">
          Identificación en listados y datos de contacto / fiscal.
        </p>
      </div>

      <fieldset className="space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          Identificación
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label-field">Nombre / razón social</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="input-app"
            />
          </div>
          <div>
            <label className="label-field">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="select-app capitalize"
            >
              <option value="particular">Particular</option>
              <option value="constructor">Constructor</option>
            </select>
          </div>
          <div>
            <label className="label-field">Nombre (persona)</label>
            <input
              value={nombrePersona}
              onChange={(e) => setNombrePersona(e.target.value)}
              placeholder="Opcional"
              className="input-app"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Apellido</label>
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Opcional"
              className="input-app"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-slate-200/80 bg-white p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          Contacto y fiscal
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field">CUIT / CUIL</label>
            <input
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              placeholder="Ej. 20-12345678-9"
              className="input-app"
              inputMode="numeric"
              autoComplete="off"
            />
            {cuitInvalido ? (
              <p className="mt-1 text-xs font-medium text-rose-700">
                CUIT/CUIL inválido (verificá el dígito final).
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
          <div className="sm:col-span-2">
            <label className="label-field">Teléfono</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="input-app"
              inputMode="tel"
              autoComplete="tel"
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
