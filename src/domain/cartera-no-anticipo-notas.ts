/**
 * Flag interno en `Movimiento.notas` (sin columna extra en BD).
 * Cobro que se conserva en historial pero no cuenta como anticipo en cartera (p. ej. PDF borrado).
 */
export const CARTERA_NO_ANTICIPO_NOTAS_MARKER = "[cc:no-anticipo-cartera]";

export function notasIndicanExcluirAnticipoCartera(notas: string | null | undefined): boolean {
  const n = notas ?? "";
  return n.includes(CARTERA_NO_ANTICIPO_NOTAS_MARKER);
}

/** Añade el marcador si falta; respeta notas previas. */
export function anexarMarcadorNoAnticipoCartera(notas: string | null | undefined): string {
  if (notasIndicanExcluirAnticipoCartera(notas)) {
    return (notas ?? "").trimEnd();
  }
  const base = (notas ?? "").trimEnd();
  return base ? `${base}\n${CARTERA_NO_ANTICIPO_NOTAS_MARKER}` : CARTERA_NO_ANTICIPO_NOTAS_MARKER;
}
