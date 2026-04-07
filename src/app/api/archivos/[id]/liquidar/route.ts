import { requireAuth } from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";
import { crearMovimiento } from "@/services/movimientos";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    medioPago?: string;
    movimientoId?: string;
  };
  const medioPago = body.medioPago === "transferencia" ? "transferencia" : "efectivo";

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
      chequeNumero: null,
      chequeBanco: null,
      chequeVencimiento: null,
      fechaRecepcion: null,
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
    chequeNumero: null,
    chequeBanco: null,
    chequeVencimiento: null,
    fechaRecepcion: null,
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
