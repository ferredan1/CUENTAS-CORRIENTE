"use client";

import { useState } from "react";
import { NuevoClienteForm } from "../NuevoClienteForm";

export function NuevoClienteToggle() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="btn-primary" onClick={() => setOpen((v) => !v)}>
        {open ? "Cancelar" : "Nuevo cliente"}
      </button>
      {open && (
        <div className="mt-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
          <NuevoClienteForm variant="compact" />
        </div>
      )}
    </div>
  );
}
