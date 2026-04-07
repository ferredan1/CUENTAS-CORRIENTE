/** Indica si hay URL y clave anónima para usar @supabase/ssr en el servidor. */
export function isSupabaseServerConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}
