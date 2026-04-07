/**
 * Convención de paths para archivos de negocio (Storage y disco público).
 * Segmentación por entidad: `clientes/{id}/…`, `proveedores/{id}/…`.
 * No incluye identidad de sesión (Supabase) en la ruta.
 */

export const STORAGE_SEGMENT = {
  clientes: "clientes",
  proveedores: "proveedores",
} as const;

/** Mismo criterio que la subida a Supabase Storage en `api/upload`. */
export function buildClienteComprobantePdfFileName(originalName: string): string {
  const nombre = originalName.trim() || "documento.pdf";
  return `${Date.now()}-${encodeURIComponent(nombre.replace(/[^\w.-]/g, "_"))}.pdf`;
}

export function supabaseObjectPathClientePdf(clienteId: string, originalName: string): string {
  return `${STORAGE_SEGMENT.clientes}/${clienteId}/${buildClienteComprobantePdfFileName(originalName)}`;
}

/** Para futuras subidas de adjuntos a proveedor: `proveedores/{proveedorId}/…`. */
export function supabaseObjectPathProveedorAdjunto(proveedorId: string, fileName: string): string {
  return `${STORAGE_SEGMENT.proveedores}/${proveedorId}/${fileName}`;
}
