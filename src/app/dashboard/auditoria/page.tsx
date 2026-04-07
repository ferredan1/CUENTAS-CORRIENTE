import { authBypassEnabled } from "@/lib/auth-mode";
import { getServerUserId } from "@/lib/get-server-user-id";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/is-server-configured";
import { redirect } from "next/navigation";
import { AuditoriaClient } from "./AuditoriaClient";

export default async function AuditoriaPage() {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");

  if (!authBypassEnabled()) {
    if (!isSupabaseServerConfigured()) redirect("/login");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }

  return <AuditoriaClient />;
}
