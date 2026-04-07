"use client";

import type { FiltroClientesTabla } from "@/types/clientes-tabla";

const OPCIONES: { id: FiltroClientesTabla; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "con_deuda", label: "Con deuda" },
  { id: "al_dia", label: "Al día" },
  { id: "vencidos", label: "Vencidos (+60 d)" },
  { id: "sin_movimientos", label: "Sin movimientos" },
];

type Props = {
  value: FiltroClientesTabla;
  onChange: (f: FiltroClientesTabla) => void;
  disabled?: boolean;
};

export function FiltrosClientes({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro de clientes">
      {OPCIONES.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={
            value === o.id
              ? "rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm ring-1 ring-emerald-700/20"
              : "rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
