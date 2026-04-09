"use client";

import { formatMoneda } from "@/lib/format";

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseFechaLocal(v: Date | string | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? new Date(v.getTime()) : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function labelEstado(fechaVenc: Date, hoy: Date): string {
  const t0 = hoy.getTime();
  const t1 = fechaVenc.getTime();
  if (t1 < t0) return "vencida";
  if (t1 === t0) return "vence hoy";
  const dias = Math.round((t1 - t0) / (1000 * 60 * 60 * 24));
  if (dias === 1) return "vence en 1 día";
  return `vence en ${dias} días`;
}

export type Item = { total: number; fechaVencimiento: Date | string | null; proveedorNombre: string };

export function FacturasProveedorBannerClient({ items }: { items: Item[] }) {
  if (items.length === 0) return null;

  const hoy = startOfTodayLocal();
  const lineas = items
    .map((row) => {
      const fv = parseFechaLocal(row.fechaVencimiento);
      if (!fv) return null;
      const monto = Number(row.total ?? 0);
      const nombre = row.proveedorNombre?.trim() || "Proveedor";
      return { nombre, monto, fv, estado: labelEstado(fv, hoy) };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (lineas.length === 0) return null;

  return (
    <section className="card-compact">
      <div className="min-w-0">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Facturas proveedores</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
          {lineas.map((l, i) => (
            <li key={`${l.nombre}-${l.fv.toISOString()}-${i}`} className="break-words">
              <span className="font-medium text-slate-900 dark:text-slate-100">{l.nombre}</span>
              <span className="text-slate-400 dark:text-slate-500"> — </span>
              <span className="font-mono tabular-nums">{formatMoneda(l.monto)}</span>
              <span className="text-slate-400 dark:text-slate-500"> — </span>
              <span
                className={
                  l.estado === "vencida"
                    ? "font-medium text-rose-700 dark:text-rose-400"
                    : l.estado === "vence hoy"
                      ? "font-medium text-amber-800 dark:text-amber-200"
                      : "text-slate-600 dark:text-slate-400"
                }
              >
                {l.estado}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
