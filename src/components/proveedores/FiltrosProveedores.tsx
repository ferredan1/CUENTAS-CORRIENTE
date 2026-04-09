"use client";

export type FiltroProveedoresRapido = "todos" | "con_deuda" | "al_dia" | "a_favor";

const OPCIONES: { id: FiltroProveedoresRapido; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "con_deuda", label: "Con deuda" },
  { id: "al_dia", label: "Al día" },
  { id: "a_favor", label: "A favor" },
];

type Props = {
  value: FiltroProveedoresRapido;
  onChange: (f: FiltroProveedoresRapido) => void;
  disabled?: boolean;
};

export function FiltrosProveedores({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro rápido de proveedores">
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
              : "rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600 dark:hover:bg-slate-700/80"
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
