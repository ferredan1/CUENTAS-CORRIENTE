"use server";

import { authBypassEnabled } from "@/lib/auth-mode";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/is-server-configured";
import { redirect } from "next/navigation";

export async function signOutAction() {
  if (authBypassEnabled()) {
    redirect("/login");
  }

  if (!isSupabaseServerConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
