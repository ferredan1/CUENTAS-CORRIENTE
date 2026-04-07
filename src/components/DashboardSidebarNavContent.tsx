"use client";

import { signOutAction } from "@/app/dashboard/actions";
import type { DashboardLink, DashboardNavSection } from "@/lib/dashboard-nav-links";
import {
  IconCash,
  IconPdf,
  IconSearch,
  IconTruck,
  IconUsers,
  IconWallet,
} from "@/components/UiIcons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  email: string;
  sections: DashboardNavSection[];
  /** Al elegir un enlace (p. ej. cerrar drawer móvil). */
  onNavigate?: () => void;
  /** Botón cerrar al lado del título (solo drawer móvil). */
  trailingHeader?: ReactNode;
};

function IconLayoutPanel({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5H4V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2h-6V5zM4 13h6v6H5a1 1 0 01-1-1v-5zm10 0h6v5a1 1 0 01-1 1h-5v-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavIcon({ href, active }: { href: string; active: boolean }) {
  const cls = active ? "text-white/90" : "text-slate-400 dark:text-slate-500";
  switch (href) {
    case "/dashboard":
      return <IconLayoutPanel className={cls} />;
    case "/dashboard/clientes":
      return <IconUsers className={`size-4 ${cls}`} />;
    case "/dashboard/proveedores":
      return <IconTruck className={`size-4 ${cls}`} />;
    case "/dashboard/cheques":
      return <IconCash className={`size-4 ${cls}`} />;
    case "/dashboard/caja":
      return <IconWallet className={`size-4 ${cls}`} />;
    case "/dashboard/carga":
      return <IconWallet className={`size-4 ${cls}`} />;
    case "/dashboard/upload":
      return <IconPdf className={`size-4 ${cls}`} />;
    case "/dashboard/buscar":
      return <IconSearch className={`size-4 ${cls}`} />;
    case "/dashboard/auditoria":
      return <IconClipboard className={cls} />;
    default:
      return <IconLayoutPanel className={cls} />;
  }
}

export function DashboardSidebarNavContent({ email, sections, onNavigate, trailingHeader }: Props) {
  const pathname = usePathname();
  const isLocal = email.includes("Modo local") || email.includes("AUTH_BYPASS");

  function isActive(link: DashboardLink): boolean {
    return link.active === "exact" ? pathname === link.href : pathname.startsWith(link.href);
  }

  function renderNavLink(link: DashboardLink) {
    const active = isActive(link);
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() => onNavigate?.()}
        className={`touch-manipulation flex items-center gap-2.5 rounded-lg border border-transparent py-2 pl-2 pr-2 text-[0.8125rem] font-medium transition-colors md:py-1.5 ${
          active
            ? "border-emerald-600/30 bg-emerald-600 text-white shadow-sm shadow-emerald-900/10 dark:border-emerald-500/40"
            : "text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900"
        }`}
        aria-current={active ? "page" : undefined}
      >
        <span className="flex size-7 shrink-0 items-center justify-center">
          <NavIcon href={link.href} active={active} />
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{link.label}</span>
          {link.href === "/dashboard/buscar" ? (
            <span
              className={`shrink-0 rounded px-1 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${
                active ? "bg-white/15 text-white/90" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              }`}
              title="Atajo: Ctrl+K / Cmd+K"
            >
              ⌘K
            </span>
          ) : null}
        </span>
      </Link>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-4 dark:border-slate-800">
        <Link href="/dashboard" className="min-w-0 flex-1 touch-manipulation" onClick={() => onNavigate?.()}>
          <span className="block text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Cuenta corriente
          </span>
          <span className="mt-1 block text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Ferretería
          </span>
          <span className="mt-0.5 block text-[0.65rem] text-slate-500 dark:text-slate-400">Sistema de gestión</span>
        </Link>
        {trailingHeader ? <div className="shrink-0 pt-0.5">{trailingHeader}</div> : null}
      </div>
      <nav
        className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto overscroll-contain px-2.5 py-3"
        aria-label="Secciones"
      >
        {sections.map((section, si) => (
          <div
            key={section.id}
            className={si > 0 ? "mt-3 border-t border-slate-100 pt-3 dark:border-slate-800/90" : ""}
          >
            {section.label ? (
              <p className="mb-1.5 px-2 text-[0.6rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section.label}
              </p>
            ) : null}
            <div className="flex flex-col gap-0.5">{section.links.map((link) => renderNavLink(link))}</div>
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-slate-200 bg-slate-50 px-2.5 pb-3 pt-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/80">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">Sesión</p>
          {isLocal ? (
            <p className="mt-1 text-[0.7rem] font-medium text-amber-800 dark:text-amber-200">Entorno local</p>
          ) : null}
          <p className="mt-1.5 truncate text-xs leading-snug text-slate-600 dark:text-slate-300" title={email}>
            {isLocal ? "Sin Supabase (dev)" : email}
          </p>
          <form action={signOutAction} className="mt-3">
            <button type="submit" className="btn-secondary w-full touch-manipulation py-2 text-xs">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
