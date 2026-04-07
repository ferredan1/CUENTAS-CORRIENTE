import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <p className="text-sm font-semibold text-slate-500">404</p>
      <h1 className="text-xl font-bold text-slate-900">Página no encontrada</h1>
      <p className="max-w-md text-sm text-slate-600">
        La ruta no existe o el enlace está desactualizado.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn-primary">
          Ir al inicio
        </Link>
        <Link href="/login" className="btn-secondary">
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}
