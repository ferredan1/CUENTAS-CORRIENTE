"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function pickDate(sp: URLSearchParams, key: string): string {
  const v = sp.get(key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

type ObraOpt = { id: string; nombre: string };
const OBRA_SIN_OBRA = "__sin_obra__";

export function EstadoCuentaControls({
  obras,
  whatsappHref,
}: {
  obras: ObraOpt[];
  /** wa.me con texto prearmado en servidor; null = sin teléfono o no enviable */
  whatsappHref: string | null;
}) {
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
    <div className="print:hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[min(100%,12rem)] flex-1 sm:flex-none sm:min-w-[12rem]">
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
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 sm:pt-0 lg:ml-auto lg:border-0 lg:pt-0 dark:border-slate-800">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex min-h-10 flex-1 items-center justify-center sm:flex-none"
            >
              Enviar por WhatsApp
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="btn-secondary inline-flex min-h-10 flex-1 cursor-not-allowed items-center justify-center opacity-60 sm:flex-none"
              title="Agregá un teléfono en la ficha del cliente"
            >
              Enviar por WhatsApp
            </button>
          )}
          <button
            type="button"
            className="btn-primary inline-flex min-h-10 flex-1 items-center justify-center sm:flex-none"
            onClick={() => window.print()}
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

