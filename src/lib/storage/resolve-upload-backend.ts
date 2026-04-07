/**
 * Supabase si hay URL + service_role y no se fuerza local.
 * En desarrollo, sin Supabase → disco (public/uploads).
 */
export function resolveUploadBackend(): "supabase" | "local" | "none" {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const hasSupabase = Boolean(url && serviceKey);

  if (process.env.UPLOAD_STORAGE === "local") {
    return "local";
  }
  if (process.env.UPLOAD_STORAGE === "supabase") {
    return hasSupabase ? "supabase" : "none";
  }

  if (hasSupabase) {
    return "supabase";
  }

  if (process.env.NODE_ENV === "development") {
    return "local";
  }

  return "none";
}
