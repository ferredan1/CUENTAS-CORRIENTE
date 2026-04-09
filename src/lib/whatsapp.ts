import { formatMoneda } from "@/lib/format";

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

export function buildWhatsappCobroUrl(
  telefono: string | null | undefined,
  nombreCliente: string,
  saldo: number,
): string | null {
  const n = normalizarTelefonoWhatsapp(telefono);
  if (!n) return null;
  const nombre = nombreCliente.trim() || "Cliente";
  const monto = formatMoneda(saldo);
  const msg = `Hola ${nombre}, te contactamos por tu cuenta en la ferretería. Saldo actual: ${monto}.`;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}
