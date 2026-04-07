import { authBypassEnabled, getBypassUserId } from "@/lib/auth-mode";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/is-server-configured";
import { NextResponse } from "next/server";

/** Sesión requerida para route handlers (Supabase Auth o bypass local). */
export async function requireAuth(): Promise<
  | { userId: string; email: string | null; error: null }
  | { userId: null; email: null; error: NextResponse }
> {
  if (authBypassEnabled()) {
    const userId = getBypassUserId();
    return { userId, email: null, error: null };
  }

  if (!isSupabaseServerConfigured()) {
    return {
      userId: null,
      email: null,
      error: NextResponse.json(
        {
          error:
            "Supabase no configurado en el servidor. Definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY, o usá AUTH_BYPASS_LOCAL=1 en desarrollo.",
        },
        { status: 503 },
      ),
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return {
      userId: null,
      email: null,
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  }

  return { userId: user.id, email: user.email ?? null, error: null };
}
