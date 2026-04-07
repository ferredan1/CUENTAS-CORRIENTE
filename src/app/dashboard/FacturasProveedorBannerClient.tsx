"use client";

import { formatMoneda } from "@/lib/format";
import Link from "next/link";
import { useMemo } from "react";

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

type Item = { total: unknown; fechaVencimiento: Date | null };

export function FacturasProveedorBannerClient({ items }: { items: Item[] }) {
  const { vencidosMonto, porVencerMonto, vencidosN, porVencerN, minDiasParaVencer } = useMemo(() => {
    const hoy = startOfTodayLocal();
    const hasta = addDays(hoy, 3);
    let vM = 0;
    let pM = 0;
    let vN = 0;
    let pN = 0;
    let minDias: number | null = null;
    for (const row of items) {
      if (!row.fechaVencimiento) continue;
      const v = new Date(row.fechaVencimiento);
      v.setHours(0, 0, 0, 0);
      if (Number.isNaN(v.getTime())) continue;
      const t = Number(row.total ?? 0);
      if (v < hoy) {
        vM += t;
        vN += 1;
      } else if (v <= hasta) {
        pM += t;
        pN += 1;
        const dias = Math.round((v.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
        if (minDias == null || dias < minDias) minDias = dias;
      }
    }
    return {
      vencidosMonto: vM,
      porVencerMonto: pM,
      vencidosN: vN,
      porVencerN: pN,
      minDiasParaVencer: minDias,
    };
  }, [items]);

  if (vencidosN === 0 && porVencerN === 0) return null;

  return (
    <section className="card-compact">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Facturas proveedores</h2>
          <p className="mt-1 text-sm text-slate-700">
            {vencidosN > 0 ? (
              <>
                <span className="font-semibold text-rose-700">{vencidosN}</span> vencida(s) (
                {formatMoneda(vencidosMonto)})
              </>
            ) : (
              <span className="text-slate-600">Sin vencidas</span>
            )}
            {" · "}
            {porVencerN > 0 ? (
              <>
                <span className="font-semibold text-amber-900">{porVencerN}</span>{" "}
                {minDiasParaVencer === 0
                  ? "vencen hoy"
                  : minDiasParaVencer === 1
                    ? "vencen en 1 día"
                    : `vencen en ${minDiasParaVencer ?? 0} días`}{" "}
                (
                {formatMoneda(porVencerMonto)})
              </>
            ) : (
              <span className="text-slate-600">Nada por vencer en 3 días</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/proveedores" className="btn-secondary">
            Ver proveedores
          </Link>
        </div>
      </div>
    </section>
  );
}
