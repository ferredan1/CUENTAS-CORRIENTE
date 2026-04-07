"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function pickDate(sp: URLSearchParams, key: string): string {
  const v = sp.get(key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

type ObraOpt = { id: string; nombre: string };
const OBRA_SIN_OBRA = "__sin_obra__";

export function EstadoCuentaControls({ obras }: { obras: ObraOpt[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const initial = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    return {
      desde: pickDate(p, "desde"),
      hasta: pickDate(p, "hasta"),
      obra: p.get("obra") ?? "",
    };
  }, [sp]);

  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [obra, setObra] = useState(initial.obra);

  function aplicar() {
    const next = new URLSearchParams(sp.toString());
    if (desde) next.set("desde", desde);
    else next.delete("desde");
    if (hasta) next.set("hasta", hasta);
    else next.delete("hasta");
    if (obra) next.set("obra", obra);
    else next.delete("obra");
    router.push(`${pathname}?${next.toString()}`);
    router.refresh();
  }

  return (
    <div className="print:hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem]">
          <span className="label-field">Obra</span>
          <select className="select-app" value={obra} onChange={(e) => setObra(e.target.value)}>
            <option value="">Todas</option>
            <option value={OBRA_SIN_OBRA}>Sin obra</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[10rem]">
          <span className="label-field">Desde</span>
          <input type="date" className="input-app" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="min-w-[10rem]">
          <span className="label-field">Hasta</span>
          <input type="date" className="input-app" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button type="button" className="btn-secondary" onClick={aplicar}>
          Aplicar
        </button>
        <button type="button" className="btn-primary ml-auto" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
      </div>
    </div>
  );
}

