/**
 * Texto por defecto al cargar «saldo anterior»; si la descripción empieza así, listados muestran tipo distinto.
 */
export const DESCRIPCION_DEFAULT_SALDO_ANTERIOR = "Saldo anterior / deuda inicial";

/** Etiqueta en tablas y PDF (evita confundir con ajustes contables genéricos). */
export function etiquetaTipoMovimientoCliente(m: { tipo: string; descripcion: string }): string {
  if (m.tipo === "ajuste" && m.descripcion.trim().toLowerCase().startsWith("saldo anterior")) {
    return "saldo anterior";
  }
  return m.tipo;
}
