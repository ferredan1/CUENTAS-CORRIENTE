import type { MedioPago, TipoCliente, TipoMovimiento } from "@prisma/client";

/** Solo tipos: los valores enum en runtime vienen mal resueltos en algunos bundles RSC/Turbopack si se importan desde aquí. */
export type { MedioPago, TipoCliente, TipoMovimiento };

const TIPOS_MOV = ["venta", "pago", "devolucion", "ajuste"] as const;
const TIPOS_CLI = ["particular", "constructor"] as const;

/** Tipos de movimiento en cuenta corriente de proveedores (UI y API). */
export const TIPOS_MOVIMIENTO_PROVEEDOR = ["compra", "pago", "ajuste"] as const;

export function esTipoMovimiento(v: string): v is TipoMovimiento {
  return (TIPOS_MOV as readonly string[]).includes(v);
}

export function esTipoCliente(v: string): v is TipoCliente {
  return (TIPOS_CLI as readonly string[]).includes(v);
}

export function esMedioPago(v: string): v is MedioPago {
  return (
    v === "efectivo" ||
    v === "transferencia" ||
    v === "cheque" ||
    v === "tarjeta_debito" ||
    v === "tarjeta_credito"
  );
}
