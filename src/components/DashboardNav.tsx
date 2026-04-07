"use client";

import { signOutAction } from "@/app/dashboard/actions";
import type { DashboardNavSection } from "@/lib/dashboard-nav-links";
import { DashboardSidebarNavContent } from "@/components/DashboardSidebarNavContent";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = { email: string; sections: DashboardNavSection[] };

function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Solo visible bajo `xl` (1280px): sidebar fijo solo en pantallas anchas.
 * El cajón se monta con portal en `document.body` para que `position:fixed` no quede
 * atrapado por `backdrop-filter` / stacking del `<header>` (evita menú “en el flujo” que ocupa media pantalla).
 */
export function DashboardNav({ email, sections }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const overlay =
    menuOpen && mounted ? (
      <>
        <button
          type="button"
          className="fixed inset-0 z-[200] bg-slate-900/40 dark:bg-black/50"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
        <div
          id="mobile-dash-drawer"
          className="fixed bottom-0 left-0 top-0 z-[210] flex h-full min-h-0 w-[min(100%,280px)] max-w-[100vw] flex-col border-r border-slate-200/90 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
          style={{
            paddingTop: "max(0px, env(safe-area-inset-top))",
            paddingBottom: "max(0px, env(safe-area-inset-bottom))",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Navegación"
        >
          <DashboardSidebarNavContent
            email={email}
            sections={sections}
            onNavigate={() => setMenuOpen(false)}
            trailingHeader={
              <button
                type="button"
                className="touch-manipulation rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Cerrar menú"
                onClick={() => setMenuOpen(false)}
              >
                <IconClose className="size-5" />
              </button>
            }
          />
        </div>
      </>
    ) : null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 pb-1 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 xl:hidden">
        <div
          className="flex items-start gap-2 px-3 pb-1 pt-2"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            className="touch-manipulation shrink-0 rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-expanded={menuOpen}
            aria-controls="mobile-dash-drawer"
            aria-label={menuOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
          <div className="min-w-0 flex-1 space-y-0.5">
            <Link href="/dashboard" className="block min-w-0 truncate leading-tight">
              <span className="block text-[0.6rem] font-semibold uppercase tracking-wider text-slate-400">
                Cuenta corriente
              </span>
              <span className="block truncate text-sm font-bold text-slate-900 dark:text-slate-100">Ferretería</span>
            </Link>
            <p className="truncate text-[0.65rem] text-slate-400 dark:text-slate-500" title={email}>
              {email}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <form action={signOutAction}>
              <button type="submit" className="btn-secondary touch-manipulation py-2 px-2.5 text-xs">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      {overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
