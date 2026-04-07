import { prisma } from "@/lib/prisma";

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

/**
 * Cheques en cartera (o sin estado todavía) vencidos o por vencer en N días.
 * Usado por banner y cron.
 */
export async function listarChequesVencimientos(days = 7) {
  const hoy = startOfToday();
  const hasta = addDays(hoy, days);
  return prisma.movimiento.findMany({
    where: {
      tipo: "pago",
      medioPago: "cheque",
      chequeVencimiento: { not: null, lte: hasta },
      OR: [{ estadoCheque: "en_cartera" }, { estadoCheque: null }],
    },
    select: {
      id: true,
      fecha: true,
      chequeVencimiento: true,
      chequeNumero: true,
      chequeBanco: true,
      total: true,
      descripcion: true,
      clienteId: true,
      cliente: { select: { nombre: true } },
      obraId: true,
      obra: { select: { nombre: true } },
    },
    orderBy: [{ chequeVencimiento: "asc" }, { fecha: "desc" }],
    take: 3000,
  });
}

/** Compras proveedor vencidas o por vencer en N días. */
export async function listarFacturasProveedorVencimientos(days = 3) {
  const hoy = startOfToday();
  const hasta = addDays(hoy, days);
  const rows = await prisma.movimientoProveedor.findMany({
    where: {
      tipo: "compra",
      liquidadoAt: null,
      liquidadoPorPagoId: null,
      fechaVencimiento: { not: null, lte: hasta },
    },
    select: { total: true, fechaVencimiento: true },
    orderBy: { fechaVencimiento: "asc" },
    take: 3000,
  });
  return rows.map((r) => ({
    total: Number(r.total),
    fechaVencimiento: r.fechaVencimiento,
  }));
}
