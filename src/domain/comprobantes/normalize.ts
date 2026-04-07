/**
 * Clave estable para comparar duplicados entre lo que escribe el usuario y lo ya guardado en BD.
 */
export function normalizarComprobanteParaDuplicado(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/[–—−]/g, "-");
  s = s.replace(/\s+/g, "");
  s = s.replace(/^(factura|fact\.?|comprobante|comp\.?|cbte\.?)+/i, "");
  s = s.replace(/^n[°ºo]\.?/i, "");
  return s;
}
