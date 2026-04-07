import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseServerConfigured } from "@/lib/supabase/is-server-configured";

export async function createClient() {
  if (!isSupabaseServerConfigured()) {
    throw new Error(
      "Supabase no configurado: definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env, o AUTH_BYPASS_LOCAL=1 en desarrollo.",
    );
  }

  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();

  return createServerClient(
    url,
    anon,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* ignore set from Server Component */
          }
        },
      },
    },
  );
}
