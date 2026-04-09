/**
 * Normaliza a dígitos para wa.me (sin +). Pensado para números argentinos.
 */
export function normalizarTelefonoWhatsapp(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length < 8) return null;
  while (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("54")) return d;
  if (d.startsWith("9") && d.length >= 10) return `54${d}`;
  if (d.length === 10) return `549${d}`;
  if (d.length >= 8 && d.length <= 11) return `54${d}`;
  return d;
}

const MAX_WA_TEXT = 3800;

/** URL wa.me con cuerpo de mensaje (UTF-8). Devuelve null si no hay teléfono válido. */
export function whatsappUrlWithBody(telefono: string | null | undefined, text: string): string | null {
  const n = normalizarTelefonoWhatsapp(telefono);
  if (!n) return null;
  const safe =
    text.length > MAX_WA_TEXT ? `${text.slice(0, MAX_WA_TEXT - 80)}\n\n… (mensaje acortado)` : text;
  return `https://wa.me/${n}?text=${encodeURIComponent(safe)}`;
}
