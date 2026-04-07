/**
 * Solo desarrollo: permite usar la app sin Supabase.
 * En producción nunca está activo, aunque la variable exista en el entorno.
 */
export function authBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const v = process.env.AUTH_BYPASS_LOCAL?.trim().toLowerCase();
  return v === "1" || v === "true";
}

export function getBypassUserId(): string {
  return process.env.LOCAL_DEV_USER_ID?.trim() || "local-dev-user";
}
