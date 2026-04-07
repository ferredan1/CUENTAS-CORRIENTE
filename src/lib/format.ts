export function formatMoneda(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatFechaCorta(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt);
}

/** Ej.: «6 de abril de 2026» */
export function formatFechaLargaHoy(): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/** ISO UTC para DTOs; tolera `Date`, string ISO o nullish (p. ej. filas legacy sin `updatedAt`). */
/**
 * Texto para listados: archivo físico + número de comprobante (letra + PV + número).
 * El registro inicial de un PDF multipágina solo guarda el nombre de archivo en `nombre`;
 * el Nº va en `comprobante`; los registros virtuales suelen tener `nombre` ya con « · …».
 */
export function etiquetaArchivoConComprobante(
  nombre: string | null | undefined,
  comprobante: string | null | undefined,
): string {
  const comp = comprobante?.trim();
  const raw = nombre?.trim();
  if (!raw && !comp) return "—";
  const base =
    raw && raw.includes(" · ")
      ? raw.slice(0, raw.indexOf(" · ")).trim()
      : raw ?? "";
  if (comp) {
    return base ? `${base} · ${comp}` : comp;
  }
  return raw ?? "—";
}

export function toIsoUtc(
  d: Date | string | null | undefined,
  fallback?: Date | string | null,
): string {
  const tryOne = (v: Date | string | null | undefined): Date | null => {
    if (v == null) return null;
    const dt = v instanceof Date ? v : new Date(v);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };
  return (tryOne(d) ?? tryOne(fallback) ?? new Date()).toISOString();
}
