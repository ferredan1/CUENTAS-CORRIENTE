"use client";

import type { DashboardNavSection } from "@/lib/dashboard-nav-links";
import { DashboardSidebarNavContent } from "@/components/DashboardSidebarNavContent";

type Props = { email: string; sections: DashboardNavSection[] };

export function DashboardSidebar({ email, sections }: Props) {
  return (
    <aside
      className="flex h-screen w-[220px] shrink-0 flex-col border-r border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-950"
      aria-label="Navegación principal"
    >
      <DashboardSidebarNavContent email={email} sections={sections} />
    </aside>
  );
}
