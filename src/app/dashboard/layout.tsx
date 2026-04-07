import { AutoRefreshDashboard } from "@/components/dashboard/AutoRefreshDashboard";
import { PagoCargadoFlash } from "@/components/dashboard/PagoCargadoFlash";
import { DashboardNav } from "@/components/DashboardNav";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { authBypassEnabled } from "@/lib/auth-mode";
import { DASHBOARD_NAV_SECTIONS } from "@/lib/dashboard-nav-links";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseServerConfigured } from "@/lib/supabase/is-server-configured";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sections = DASHBOARD_NAV_SECTIONS;

  if (authBypassEnabled()) {
    return (
      <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/30 text-slate-900">
        <div className="hidden xl:block">
          <DashboardSidebar email="Modo local (sin Supabase) — AUTH_BYPASS_LOCAL" sections={sections} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardNav email="Modo local (sin Supabase) — AUTH_BYPASS_LOCAL" sections={sections} />
          <main className="mx-auto w-full max-w-[min(100%,1920px)] flex-1 overflow-x-visible overflow-y-visible px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:py-6 sm:pb-6 md:px-6 lg:px-8 xl:px-10">
            <AutoRefreshDashboard />
            <PagoCargadoFlash />
            {children}
          </main>
        </div>
      </div>
    );
  }

  if (!isSupabaseServerConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50/30 text-slate-900">
      <div className="hidden xl:block">
        <DashboardSidebar email={user.email ?? ""} sections={sections} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardNav email={user.email ?? ""} sections={sections} />
        <main className="mx-auto w-full max-w-[min(100%,1920px)] flex-1 overflow-x-visible overflow-y-visible px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:py-6 sm:pb-6 md:px-6 lg:px-8 xl:px-10">
          <AutoRefreshDashboard />
          <PagoCargadoFlash />
          {children}
        </main>
      </div>
    </div>
  );
}
