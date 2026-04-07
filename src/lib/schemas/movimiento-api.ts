import { z } from "zod";

const tipoMov = z.enum(["venta", "pago", "devolucion", "ajuste"]);

export const crearMovimientoBodySchema = z.object({
  clienteId: z.string().min(1),
  obraId: z.string().nullable().optional(),
  tipo: tipoMov.optional(),
  fecha: z.string().optional(),
  comprobante: z.string().nullable().optional(),
  codigoProducto: z.string().nullable().optional(),
  medioPago: z.string().nullable().optional(),
  estadoCheque: z.string().nullable().optional(),
  chequeNumero: z.string().nullable().optional(),
  chequeBanco: z.string().max(100).nullable().optional(),
  chequeVencimiento: z.string().nullable().optional(),
  fechaRecepcion: z.string().nullable().optional(),
  descripcion: z.string().optional(),
  cantidad: z.number().finite(),
  precioUnitario: z.number().finite(),
  archivoId: z.string().nullable().optional(),
});

export type CrearMovimientoBody = z.infer<typeof crearMovimientoBodySchema>;
