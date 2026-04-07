"use client";

import { IconSearch } from "@/components/UiIcons";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Búsqueda global del panel: sincroniza `?q=` con el servidor para que la vista previa de clientes
 * use el mismo criterio sin duplicar el input debajo.
 */
export function DashboardPanelTopBar({
  initialQ,
  children,
}: {
  initialQ: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const skipPushRef = useRef(true);
  const [q, setQ] = useState(initialQ);
  const debouncedQ = useDebouncedValue(q, 320);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  const pushQ = useCallback(
    (next: string) => {
      const params = new URLSearchParams();
      const t = next.trim();
      if (t) params.set("q", t);
      const qs = params.toString();
      router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    if (skipPushRef.current) {
      skipPushRef.current = false;
      return;
    }
    pushQ(debouncedQ);
  }, [debouncedQ, pushQ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
      <div className="relative min-w-0 flex-1 lg:max-w-2xl">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <IconSearch className="size-5" />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente, CUIT, comprobante…"
          className="input-app h-11 w-full pl-10 pr-3 text-sm shadow-sm sm:pr-14 dark:border-slate-700 dark:bg-slate-900"
          autoComplete="off"
          aria-label="Buscar en el panel"
        />
        <span
          className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[0.6rem] font-medium text-slate-400 dark:border-slate-600 dark:bg-slate-800 sm:inline-block"
          title="Atajo: Ctrl+K / Cmd+K"
        >
          ⌘K
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}
