export async function register() {
  if (process.env.VERCEL_ENV === "production") {
    const v = process.env.AUTH_BYPASS_LOCAL?.trim().toLowerCase();
    if (v === "1" || v === "true") {
      throw new Error(
        "AUTH_BYPASS_LOCAL no debe estar activo en producción (VERCEL_ENV=production). Quitá la variable en Vercel.",
      );
    }
  }
}
