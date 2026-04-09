"use client";

import { useEffect, useId } from "react";

export function CenteredFormModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] dark:bg-black/65"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(90dvh,40rem)] w-full max-w-lg overflow-y-auto overscroll-y-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:max-h-[min(88vh,720px)] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <h2 id={titleId} className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-tertiary h-9 shrink-0 px-3 py-0 text-sm"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
