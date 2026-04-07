export class ValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = "No encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Errores de negocio (`Error`) se mapean a 400 por defecto (compatibilidad con servicios actuales).
 * Fallos no previstos (no instancia de `Error`) → 500.
 */
export function jsonErrorStatus(e: unknown): { status: number; message: string } {
  if (e instanceof ValidationError) return { status: e.statusCode, message: e.message };
  if (e instanceof NotFoundError) return { status: e.statusCode, message: e.message };
  if (e instanceof Error) return { status: 400, message: e.message };
  return { status: 500, message: "Error" };
}
