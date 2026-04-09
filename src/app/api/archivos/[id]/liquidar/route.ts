import { requireAuth } from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";
import { crearMovimiento } from "@/services/movimientos";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

function parseOptionalDay(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(`${s.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MEDIOS = new Set([
  "efectivo",
  "transferencia",
  "cheque",
  "tarjeta_debito",
  "tarjeta_credito",
]);

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    medioPago?: string;
    movimientoId?: string;
    chequeNumero?: string | null;
    chequeBanco?: string | null;
    chequeVencimiento?: string | null;
    fechaRecepcion?: string | null;
  };
  const medioRaw = (body.medioPago ?? "").trim().toLowerCase();
  const medioPago = MEDIOS.has(medioRaw) ? medioRaw : "efectivo";
  const chequeNumero = body.chequeNumero?.trim() || null;
  const chequeBanco = body.chequeBanco?.trim() || null;
  const chequeVencimiento = parseOptionalDay(body.chequeVencimiento ?? null);
  const fechaRecepcion = parseOptionalDay(body.fechaRecepcion ?? null);

  if (medioPago === "cheque") {
    if (!chequeBanco || !chequeNumero || !chequeVencimiento || !fechaRecepcion) {
      return NextResponse.json(
        { error: "Para cheque indicá banco, número, vencimiento y fecha de recepción." },
        { status: 400 },
      );
    }
  }

  const archivo = await prisma.archivo.findFirst({
    where: { id },
    select: { id: true, clienteId: true },
  });
  if (!archivo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const movimientoId = body.movimientoId?.trim() || null;

  if (movimientoId) {
    const venta = await prisma.movimiento.findFirst({
      where: {
        id: movimientoId,
        archivoId: id,
        clienteId: archivo.clienteId,
        tipo: "venta",
        liquidadoAt: null,
        saldoPendiente: { gt: 0 },
      },
      select: { id: true, total: true, saldoPendiente: true, comprobante: true },
    });
    if (!venta) {
      return NextResponse.json({ error: "Venta no encontrada o ya liquidada" }, { status: 400 });
    }
    const total = Number(venta.saldoPendiente ?? venta.total ?? 0);
    const comp = venta.comprobante?.trim() || null;
    await crearMovimiento({
      clienteId: archivo.clienteId,
      obraId: null,
      tipo: "pago",
      fecha: new Date(),
      comprobante: comp,
      codigoProducto: null,
      medioPago,
      chequeNumero: medioPago === "cheque" ? chequeNumero : null,
      chequeBanco: medioPago === "cheque" ? chequeBanco : null,
      chequeVencimiento: medioPago === "cheque" ? chequeVencimiento : null,
      fechaRecepcion: medioPago === "cheque" ? fechaRecepcion : null,
      descripcion: `Pago ítem comprobante ${comp ?? "s/n"} (marcado desde movimientos)`,
      cantidad: 1,
      precioUnitario: total,
      liquidarVentaIds: [venta.id],
    });
    return NextResponse.json({
      ok: true,
      movimientosLiquidados: 1,
      totalRegistrado: total,
    });
  }

  const ventasPendientes = await prisma.movimiento.findMany({
    where: {
      archivoId: id,
      clienteId: archivo.clienteId,
      tipo: "venta",
      liquidadoAt: null,
      saldoPendiente: { gt: 0 },
    },
    select: { id: true, total: true, saldoPendiente: true, comprobante: true },
  });

  if (ventasPendientes.length === 0) {
    return NextResponse.json({ ok: true, movimientosLiquidados: 0, totalRegistrado: 0 });
  }

  const totalAPagar = ventasPendientes.reduce((s, v) => s + Number(v.saldoPendiente ?? v.total ?? 0), 0);
  const comprobante = ventasPendientes[0]?.comprobante ?? null;

  await crearMovimiento({
    clienteId: archivo.clienteId,
    obraId: null,
    tipo: "pago",
    fecha: new Date(),
    comprobante,
    codigoProducto: null,
    medioPago,
    chequeNumero: medioPago === "cheque" ? chequeNumero : null,
    chequeBanco: medioPago === "cheque" ? chequeBanco : null,
    chequeVencimiento: medioPago === "cheque" ? chequeVencimiento : null,
    fechaRecepcion: medioPago === "cheque" ? fechaRecepcion : null,
    descripcion: `Pago comprobante ${comprobante ?? "s/n"} (marcado desde comprobantes)`,
    cantidad: 1,
    precioUnitario: totalAPagar,
    liquidarVentaIds: ventasPendientes.map((v) => v.id),
  });

  return NextResponse.json({
    ok: true,
    movimientosLiquidados: ventasPendientes.length,
    totalRegistrado: totalAPagar,
  });
}
