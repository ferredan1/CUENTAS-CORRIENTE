import { requireAuth } from "@/lib/auth-api";
import { parseQueryDayEnd, parseQueryDayStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { conMovimientoOtroParaSaldoCartera } from "@/domain/cartera-movimiento-where";
import { cargarAnticiposEnPagos } from "@/services/cartera-pago-anticipo";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const sp = req.nextUrl.searchParams;
  const clienteId = sp.get("clienteId") ?? undefined;
  const obraId = sp.get("obraId") ?? undefined;
  const sinObra = sp.get("sinObra") === "1" || sp.get("sinObra") === "true";
  const desde = parseQueryDayStart(sp.get("desde"));
  const hasta = parseQueryDayEnd(sp.get("hasta"));

  const where: Prisma.MovimientoWhereInput = {};

  if (clienteId) where.clienteId = clienteId;
  if (sinObra) where.obraId = null;
  else if (obraId !== undefined && obraId !== "") where.obraId = obraId;

  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = desde;
    if (hasta) where.fecha.lte = hasta;
  }

  const [ventaAgg, otroAgg, anticipoPagos] = await Promise.all([
    prisma.movimiento.aggregate({
      where: { ...where, tipo: "venta" },
      _sum: { saldoPendiente: true },
    }),
    prisma.movimiento.groupBy({
      by: ["tipo"],
      where: conMovimientoOtroParaSaldoCartera(where),
      _sum: { total: true },
    }),
    cargarAnticiposEnPagos(where),
  ]);

  const porTipo: Record<string, number> = { venta: Number(ventaAgg._sum?.saldoPendiente ?? 0) };
  for (const g of otroAgg) {
    porTipo[g.tipo] = Number(g._sum?.total ?? 0);
  }
  porTipo.pago = anticipoPagos.reduce((s, f) => s + f.anticipo, 0);

  return NextResponse.json({ porTipo });
}
