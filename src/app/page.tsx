import { authBypassEnabled } from "@/lib/auth-mode";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/is-server-configured";
import { redirect } from "next/navigation";

export default async function Home() {
  if (authBypassEnabled()) {
    redirect("/dashboard");
  }

  if (!isSupabaseServerConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}
