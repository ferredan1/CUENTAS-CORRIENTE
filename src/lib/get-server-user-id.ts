import { authBypassEnabled, getBypassUserId } from "@/lib/auth-mode";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/is-server-configured";

export async function getServerUserId(): Promise<string | null> {
  if (authBypassEnabled()) {
    return getBypassUserId();
  }
  if (!isSupabaseServerConfigured()) {
    return null;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
