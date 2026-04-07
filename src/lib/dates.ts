/**
 * Fechas “de calendario”: mediodía local para evitar corrimientos TZ al persistir/leer día ISO.
 * Convención: strings `YYYY-MM-DD` o datetime completos vía `parseDateTimeFlexible`.
 */
export function parseCalendarDayOrNull(s: string | null | undefined): Date | null {
  if (s == null || String(s).trim() === "") return null;
  const d = new Date(`${String(s).trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Filtros `desde`/`hasta` en query string: rangos inclusivos (00:00..23:59:59.999). */
export function parseQueryDayStart(s: string | null | undefined): Date | undefined {
  if (!s?.trim()) return undefined;
  const d = new Date(`${s.trim()}T00:00:00.000`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseQueryDayEnd(s: string | null | undefined): Date | undefined {
  if (!s?.trim()) return undefined;
  const d = new Date(`${s.trim()}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
