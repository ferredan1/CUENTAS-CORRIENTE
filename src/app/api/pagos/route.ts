import { requireAuth } from "@/lib/auth-api";
import { serializePago } from "@/lib/pago-json";
import { serializeMovimiento } from "@/lib/movimiento-json";
import { crearPago } from "@/services/pagos.service";
import { crearMovimiento } from "@/services/movimientos";
import { prisma } from "@/lib/prisma";
import { normalizarComprobanteParaDuplicado } from "@/domain/comprobantes/normalize";
import { NextRequest, NextResponse } from "next/server";

function parseOptionalDay(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(`${s.trim()}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as {
      version?: number;
      clienteId?: string;
      obraId?: string | null;
      fecha?: string;
      comprobante?: string | null;
      descripcion?: string;
      monto?: number;
      importeTotal?: number;
      medioPago?: string | null;
      chequeNumero?: string | null;
      chequeBanco?: string | null;
      chequeVencimiento?: string | null;
      fechaRecepcion?: string | null;
      liquidarVentaId?: string;
      observaciones?: string | null;
      aplicaciones?: { movimientoId: string; importeAplicado: number }[];
    };

    const useV2 = body.version === 2 || (body.importeTotal != null && Number.isFinite(Number(body.importeTotal)));

    if (useV2) {
      const importeTotal = Number(body.importeTotal ?? 0);
      if (!Number.isFinite(importeTotal) || importeTotal <= 0) {
        return NextResponse.json({ error: "importeTotal inválido" }, { status: 400 });
      }
      const fecha = body.fecha ? new Date(body.fecha) : new Date();
      const chVto = parseOptionalDay(body.chequeVencimiento ?? null);
      const chRec = parseOptionalDay(body.fechaRecepcion ?? null);
      const aplicaciones = Array.isArray(body.aplicaciones) ? body.aplicaciones : undefined;

      const pago = await crearPago({
        clienteId: body.clienteId ?? "",
        obraId: body.obraId ?? null,
        fecha,
        importeTotal,
        medioPago: body.medioPago,
        comprobante: body.comprobante,
        observaciones: body.observaciones,
        descripcion: body.descripcion,
        chequeNumero: body.chequeNumero,
        chequeBanco: body.chequeBanco,
        chequeVencimiento: chVto,
        fechaRecepcion: chRec,
        aplicaciones,
      });
      return NextResponse.json({ version: 2, pago: serializePago(pago) }, { status: 201 });
    }

    const fecha = body.fecha ? new Date(body.fecha) : new Date();
    let monto = Number(body.monto ?? 0);
    const medio = (body.medioPago ?? "").trim().toLowerCase() || null;
    const compTrim = body.comprobante?.trim() || "";
    const liquidarVentaId = body.liquidarVentaId?.trim() || null;

    if (compTrim && (!Number.isFinite(monto) || monto <= 0)) {
      const key = normalizarComprobanteParaDuplicado(compTrim);
      const normalized = key.length >= 2 ? key : null;
      const agg = await prisma.movimiento.aggregate({
        where: {
          clienteId: body.clienteId ?? "",
          tipo: "venta",
          liquidadoAt: null,
          archivoId: { not: null },
          OR: [
            ...(normalized ? [{ normalizedComprobante: normalized }] : []),
            { comprobante: compTrim },
          ],
        },
        _sum: { saldoPendiente: true },
      });
      monto = Number(agg._sum.saldoPendiente ?? 0);
      if (!Number.isFinite(monto) || monto <= 0) {
        return NextResponse.json(
          { error: "No hay ventas pendientes para ese comprobante (o ya está cancelado)." },
          { status: 400 },
        );
      }
    }

    let chequeVencimiento: Date | null = null;
    let fechaRecepcion: Date | null = null;
    if (medio === "cheque") {
      if (!body.chequeBanco?.trim()) {
        return NextResponse.json({ error: "Indicá el banco del cheque." }, { status: 400 });
      }
      if (!body.chequeNumero?.trim()) {
        return NextResponse.json({ error: "Indicá el número de cheque." }, { status: 400 });
      }
      if (!body.chequeVencimiento?.trim()) {
        return NextResponse.json({ error: "Indicá el vencimiento del cheque." }, { status: 400 });
      }
      if (!body.fechaRecepcion?.trim()) {
        return NextResponse.json(
          { error: "Indicá la fecha en que se recibió el cheque." },
          { status: 400 },
        );
      }
      chequeVencimiento = new Date(`${body.chequeVencimiento.trim()}T12:00:00`);
      fechaRecepcion = new Date(`${body.fechaRecepcion.trim()}T12:00:00`);
      if (Number.isNaN(chequeVencimiento.getTime()) || Number.isNaN(fechaRecepcion.getTime())) {
        return NextResponse.json({ error: "Fechas de cheque inválidas." }, { status: 400 });
      }
    }

    if (liquidarVentaId) {
      const venta = await prisma.movimiento.findFirst({
        where: {
          id: liquidarVentaId,
          clienteId: body.clienteId ?? "",
          tipo: "venta",
          liquidadoAt: null,
        },
        select: { id: true, total: true, saldoPendiente: true, comprobante: true },
      });
      if (!venta) {
        return NextResponse.json(
          { error: "Venta no encontrada o ya liquidada." },
          { status: 400 },
        );
      }
      if (!Number.isFinite(monto) || monto <= 0) {
        monto = Number(venta.saldoPendiente ?? venta.total ?? 0);
      }
      const comprobantePago = compTrim || venta.comprobante?.trim() || null;
      const m = await crearMovimiento({
        clienteId: body.clienteId ?? "",
        obraId: body.obraId ?? null,
        tipo: "pago",
        fecha,
        comprobante: comprobantePago,
        codigoProducto: null,
        medioPago: medio,
        chequeNumero: medio === "cheque" ? body.chequeNumero!.trim() : null,
        chequeBanco: medio === "cheque" ? body.chequeBanco!.trim() : null,
        chequeVencimiento: medio === "cheque" ? chequeVencimiento : null,
        fechaRecepcion: medio === "cheque" ? fechaRecepcion : null,
        descripcion: (body.descripcion ?? `Pago ${comprobantePago ?? "venta"} (desde API)`).trim(),
        cantidad: 1,
        precioUnitario: monto,
        liquidarVentaIds: [venta.id],
      });
      return NextResponse.json(serializeMovimiento(m), { status: 201 });
    }

    const m = await crearMovimiento({
      clienteId: body.clienteId ?? "",
      obraId: body.obraId ?? null,
      tipo: "pago",
      fecha,
      comprobante: body.comprobante ?? null,
      codigoProducto: null,
      medioPago: medio,
      chequeNumero: medio === "cheque" ? body.chequeNumero!.trim() : null,
      chequeBanco: medio === "cheque" ? body.chequeBanco!.trim() : null,
      chequeVencimiento: medio === "cheque" ? chequeVencimiento : null,
      fechaRecepcion: medio === "cheque" ? fechaRecepcion : null,
      descripcion: (body.descripcion ?? (compTrim ? `Pago comprobante ${compTrim}` : "Pago")).trim(),
      cantidad: 1,
      precioUnitario: monto,
    });
    return NextResponse.json(serializeMovimiento(m), { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
