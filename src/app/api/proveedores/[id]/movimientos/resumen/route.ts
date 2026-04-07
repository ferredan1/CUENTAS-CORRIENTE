import { requireAuth } from "@/lib/auth-api";
import { parseQueryDayEnd, parseQueryDayStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id: proveedorId } = await params;

  const ok = await prisma.proveedor.findFirst({
    where: { id: proveedorId },
    select: { id: true },
  });
  if (!ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const desde = parseQueryDayStart(sp.get("desde"));
  const hasta = parseQueryDayEnd(sp.get("hasta"));

  const whereBase: Prisma.MovimientoProveedorWhereInput = { proveedorId };

  if (desde || hasta) {
    whereBase.fecha = {};
    if (desde) whereBase.fecha.gte = desde;
    if (hasta) whereBase.fecha.lte = hasta;
  }

  const [compraPendiente, compraLiquidada, pagos, ajustes] = await Promise.all([
    prisma.movimientoProveedor.aggregate({
      where: { ...whereBase, tipo: "compra", liquidadoAt: null },
      _sum: { total: true },
    }),
    prisma.movimientoProveedor.aggregate({
      where: { ...whereBase, tipo: "compra", liquidadoAt: { not: null } },
      _sum: { total: true },
    }),
    prisma.movimientoProveedor.aggregate({
      where: { ...whereBase, tipo: "pago" },
      _sum: { total: true },
    }),
    prisma.movimientoProveedor.aggregate({
      where: { ...whereBase, tipo: "ajuste" },
      _sum: { total: true },
    }),
  ]);

  const porTipo: Record<string, number> = {
    compra: Number(compraPendiente._sum?.total ?? 0),
    pago: Number(pagos._sum?.total ?? 0) + Number(compraLiquidada._sum?.total ?? 0),
    ajuste: Number(ajustes._sum?.total ?? 0),
  };

  return NextResponse.json({ porTipo });
}
