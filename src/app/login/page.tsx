import { authBypassEnabled } from "@/lib/auth-mode";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (authBypassEnabled()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-emerald-50/50 p-4">
        <div className="card w-full max-w-md text-center shadow-lg">
          <p className="badge-ok mx-auto w-fit">Desarrollo local</p>
          <h1 className="page-title mt-4">Sin inicio de sesión</h1>
          <p className="page-subtitle mx-auto mt-2">
            Tenés{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
              AUTH_BYPASS_LOCAL
            </code>{" "}
            activo.
          </p>
          <Link href="/dashboard" className="btn-primary mt-6 inline-flex">
            Ir al panel
          </Link>
        </div>
      </div>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnon) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-amber-50/40 p-4">
        <div className="card w-full max-w-md text-center shadow-lg">
          <h1 className="page-title">Falta configuración de Supabase</h1>
          <p className="page-subtitle mx-auto mt-2">
            Definí <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env</code>, o activá{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">AUTH_BYPASS_LOCAL=1</code> solo en desarrollo.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
