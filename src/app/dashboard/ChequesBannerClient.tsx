"use client";

import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { useMemo } from "react";

type ChequeRow = Prisma.MovimientoGetPayload<{
  select: { id: true; chequeVencimiento: true };
}>;

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

export function ChequesBannerClient({ cheques }: { cheques: ChequeRow[] }) {
  const { vencidos, porVencerEn7 } = useMemo(() => {
    const hoy = startOfTodayLocal();
    const hasta = addDays(hoy, 7);
    let vencidosAcc = 0;
    let porVencerAcc = 0;
    for (const c of cheques) {
      if (!c.chequeVencimiento) continue;
      const v = new Date(c.chequeVencimiento);
      v.setHours(0, 0, 0, 0);
      if (Number.isNaN(v.getTime())) continue;
      if (v < hoy) vencidosAcc += 1;
      else if (v <= hasta) porVencerAcc += 1;
    }
    return { vencidos: vencidosAcc, porVencerEn7: porVencerAcc };
  }, [cheques]);

  if (vencidos === 0 && porVencerEn7 === 0) return null;

  return (
    <section className="card-compact">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cheques</h2>
          <p className="mt-1 text-sm text-slate-700">
            {vencidos > 0 ? (
              <>
                <span className="font-semibold text-rose-700">{vencidos}</span> vencido(s)
              </>
            ) : (
              <span className="text-slate-600">Sin vencidos</span>
            )}
            {" · "}
            {porVencerEn7 > 0 ? (
              <>
                <span className="font-semibold text-amber-900">{porVencerEn7}</span> vencen en 7 días
              </>
            ) : (
              <span className="text-slate-600">Nada por vencer esta semana</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {vencidos > 0 && (
            <Link href="/dashboard/cheques" className="btn-secondary">
              Ver cheques
            </Link>
          )}
          {porVencerEn7 > 0 && (
            <Link href="/dashboard/cheques" className="btn-tertiary">
              Ver por vencer
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

