export type EstadoCobranza = "al_dia" | "en_gestion" | "moroso" | "incobrable";

export function ClienteCobranzaBadge({
  estado,
  saldo,
  deudaMas90,
}: {
  estado: EstadoCobranza | undefined;
  saldo: number;
  deudaMas90?: number;
}) {
  if (!(saldo > 0)) {
    if (saldo < 0)
      return <span className="badge-ok">A favor</span>;
    return (
      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-200">
        Al día
      </span>
    );
  }
  const plus90 =
    (deudaMas90 ?? 0) > 0 ? (
      <span
        className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
        title="Deuda con antigüedad > 90 días"
      >
        +90d
      </span>
    ) : null;
  if (estado === "incobrable")
    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 dark:bg-red-950/45 dark:text-red-200">
          Incobrable
        </span>
        {plus90}
      </span>
    );
  if (estado === "moroso") {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-950 dark:bg-orange-950/40 dark:text-orange-100">
          Moroso
        </span>
        {plus90}
      </span>
    );
  }
  if (estado === "en_gestion")
    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-950 dark:bg-yellow-950/35 dark:text-yellow-100">
          En gestión
        </span>
        {plus90}
      </span>
    );
  if (estado === "al_dia")
    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-200">
          Al día
        </span>
        {plus90}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-950 dark:bg-orange-950/40 dark:text-orange-100">
        Deuda
      </span>
      {plus90}
    </span>
  );
}
