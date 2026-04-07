/** Total en moneda con 2 decimales (evita float para la lógica; persistencia en Decimal). */
export function calcularTotalMovimiento(cantidad: number, precioUnitario: number): number {
  if (!Number.isFinite(cantidad) || !Number.isFinite(precioUnitario)) {
    throw new Error("Cantidad o precio no válidos");
  }
  return Math.round(cantidad * precioUnitario * 100) / 100;
}

export function assertVentaTieneArchivo(archivoId: string | null | undefined): void {
  if (!archivoId?.trim()) {
    throw new Error(
      "Las ventas deben asociarse a un comprobante PDF: suba el archivo desde el cliente u obra.",
    );
  }
}

export function assertPagoChequeCompleto(
  tipo: string,
  medio: string | null,
  chequeNumero: string | null | undefined,
  chequeBanco: string | null | undefined,
  chequeVencimiento: Date | null | undefined,
  fechaRecepcion: Date | null | undefined,
): void {
  if (tipo !== "pago" || medio !== "cheque") return;
  if (!chequeBanco?.trim()) throw new Error("Indicá el banco del cheque.");
  if (!chequeNumero?.trim()) throw new Error("Indicá el número de cheque.");
  if (!chequeVencimiento || Number.isNaN(chequeVencimiento.getTime())) {
    throw new Error("Indicá el vencimiento del cheque.");
  }
  if (!fechaRecepcion || Number.isNaN(fechaRecepcion.getTime())) {
    throw new Error("Indicá la fecha en que se recibió el cheque.");
  }
}

type MovExistente = {
  tipo: string;
  archivoId: string | null;
  comprobante: string | null;
  cantidad: number;
  precioUnitario: unknown;
};

/**
 * Ventas ligadas a PDF: se mantiene el comprobante y el tipo «venta»; cantidad y P.U. se pueden corregir en grilla.
 */
export function assertPatchPermitidoVentaImportada(
  existente: MovExistente,
  patch: Partial<{
    comprobante: string | null;
    cantidad: number;
    precioUnitario: number;
    tipo: string;
  }>,
): void {
  if (existente.tipo !== "venta" || !existente.archivoId) return;

  if (patch.tipo !== undefined && patch.tipo !== "venta") {
    throw new Error("No se puede cambiar el tipo de una venta importada desde PDF.");
  }
  if (patch.comprobante !== undefined && patch.comprobante !== existente.comprobante) {
    throw new Error("No se puede editar el comprobante de una venta vinculada a un PDF.");
  }
}
