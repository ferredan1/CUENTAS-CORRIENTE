import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return unauthorized();
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return unauthorized();

  const hoy = startOfToday();
  const hasta7 = addDays(hoy, 7);
  const hasta3 = addDays(hoy, 3);

  const [cheques, facturasProveedor] = await Promise.all([
    prisma.movimiento.findMany({
      where: {
        tipo: "pago",
        medioPago: "cheque",
        chequeVencimiento: { not: null, lte: hasta7 },
        estadoCheque: "en_cartera",
      },
      orderBy: [{ chequeVencimiento: "asc" }, { fecha: "desc" }],
      select: {
        id: true,
        chequeVencimiento: true,
        chequeBanco: true,
        chequeNumero: true,
        total: true,
        clienteId: true,
        cliente: { select: { nombre: true } },
        obraId: true,
        obra: { select: { nombre: true } },
      },
      take: 5000,
    }),
    prisma.movimientoProveedor.findMany({
      where: {
        tipo: "compra",
        fechaVencimiento: { not: null, lte: hasta3 },
      },
      orderBy: { fechaVencimiento: "asc" },
      select: { id: true, proveedorId: true, total: true, fechaVencimiento: true, comprobante: true },
      take: 5000,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    hoy: hoy.toISOString(),
    cheques: {
      count: cheques.length,
      items: cheques.map((c) => ({
        id: c.id,
        clienteId: c.clienteId,
        clienteNombre: c.cliente.nombre,
        obraId: c.obraId,
        obraNombre: c.obra?.nombre ?? null,
        chequeVencimiento: c.chequeVencimiento?.toISOString() ?? null,
        chequeBanco: (c as { chequeBanco?: string | null }).chequeBanco ?? null,
        chequeNumero: c.chequeNumero ?? null,
        total: Number(c.total),
      })),
    },
    facturasProveedor: {
      count: facturasProveedor.length,
      items: facturasProveedor.map((f) => ({
        id: f.id,
        proveedorId: f.proveedorId,
        comprobante: f.comprobante ?? null,
        fechaVencimiento: f.fechaVencimiento?.toISOString() ?? null,
        total: Number(f.total),
      })),
    },
  });
}
