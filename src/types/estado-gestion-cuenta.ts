import type { EstadoGestionCuenta } from "@prisma/client";

export const ESTADOS_GESTION_CUENTA: EstadoGestionCuenta[] = [
  "CUENTA_CERRADA",
  "EN_GESTION",
  "FACTURADO_ENVIADO",
  "FALTA_PAGO",
];

export const ETIQUETA_ESTADO_GESTION: Record<EstadoGestionCuenta, string> = {
  CUENTA_CERRADA: "Cuenta cerrada",
  EN_GESTION: "En gestión",
  FACTURADO_ENVIADO: "Facturado / enviado",
  FALTA_PAGO: "Falta pago",
};

export function esEstadoGestionCuenta(v: string): v is EstadoGestionCuenta {
  return ESTADOS_GESTION_CUENTA.includes(v as EstadoGestionCuenta);
}
