import Link from "next/link";

/** Botones globales del panel: evitar duplicar en tablas o bloques inferiores. */
export function DashboardPrimaryActions({
  includeNuevoCliente = true,
}: {
  /** En `/dashboard/clientes` suele mostrarse otro enlace «Nuevo cliente» (p. ej. alta rápida). */
  includeNuevoCliente?: boolean;
}) {
  return (
    <div className="toolbar-cluster shrink-0 flex-wrap justify-end">
      <Link href="/dashboard/upload" className="btn-tertiary">
        Nueva venta
      </Link>
      <Link href="/dashboard/carga" className="btn-secondary">
        Registrar cobro
      </Link>
      {includeNuevoCliente ? (
        <Link href="/dashboard/clientes" className="btn-primary">
          + Nuevo cliente
        </Link>
      ) : null}
    </div>
  );
}
