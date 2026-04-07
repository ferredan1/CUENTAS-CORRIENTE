"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "flashPagoOk";
const EVENT = "pago-cargado-flash";

/** Tras cargar pago en la misma vista (sin cambiar de ruta). */
export function signalPagoCargadoFlash() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

/** Antes de `router.push` a otra ruta del dashboard (la próxima página lee el flag al montar). */
export function markPagoCargadoForNextDashboardPage() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, "1");
}

export function PagoCargadoFlash() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      closeTimer.current = null;
    }, 8000);
  }, []);

  useEffect(() => {
    const onEvt = () => show();
    window.addEventListener(EVENT, onEvt);
    return () => window.removeEventListener(EVENT, onEvt);
  }, [show]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY) !== "1") return;
    sessionStorage.removeItem(STORAGE_KEY);
    show();
  }, [pathname, show]);

  if (!open) return null;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-100"
      role="status"
      aria-live="polite"
    >
      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Pago cargado</p>
        <p className="mt-0.5 text-[0.85rem] opacity-90">
          El movimiento quedó registrado. Podés verlo en el estado de cuenta del cliente.
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg border border-emerald-300/80 bg-white/80 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-white dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100"
        onClick={() => setOpen(false)}
      >
        Cerrar
      </button>
    </div>
  );
}
