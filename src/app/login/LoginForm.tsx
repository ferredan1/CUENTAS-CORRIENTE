"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      router.refresh();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/40 p-4">
      <div className="card w-full max-w-md shadow-lg shadow-slate-200/50">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Ferretería
          </p>
          <h1 className="page-title mt-1">Cuenta corriente</h1>
          <p className="page-subtitle mt-2">Acceso con Supabase Auth</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label-field">
              Correo
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-app"
            />
          </div>
          <div>
            <label htmlFor="password" className="label-field">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-app"
            />
          </div>
          {error && (
            <p className="alert-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Procesando…" : "Entrar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Solo podés iniciar sesión con la cuenta habilitada para esta aplicación.
        </p>
        <p className="mt-4 text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-700">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
