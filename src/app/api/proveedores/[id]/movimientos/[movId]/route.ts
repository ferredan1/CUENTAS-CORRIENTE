import { jsonErrorStatus } from "@/lib/api-errors";
import { requireAuth } from "@/lib/auth-api";
import { parseCalendarDayOrNull } from "@/lib/dates";
import { actualizarMovimientoProveedor, eliminarMovimientoProveedor } from "@/services/proveedores";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string; movId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { movId } = await params;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const patch: Parameters<typeof actualizarMovimientoProveedor>[1] = {};

    if ("fecha" in body && typeof body.fecha === "string") {
      const d = new Date(body.fecha);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
      patch.fecha = d;
    }
    if ("descripcion" in body && typeof body.descripcion === "string") patch.descripcion = body.descripcion;
    if ("comprobante" in body) {
      patch.comprobante = body.comprobante === null ? null : typeof body.comprobante === "string" ? body.comprobante : null;
    }
    if ("cantidad" in body && typeof body.cantidad === "number") patch.cantidad = body.cantidad;
    if ("precioUnitario" in body && typeof body.precioUnitario === "number") patch.precioUnitario = body.precioUnitario;
    if ("tipo" in body && typeof body.tipo === "string") patch.tipo = body.tipo;
    if ("liquidadoAt" in body) {
      const v = (body as { liquidadoAt?: unknown }).liquidadoAt;
      if (v === null || v === "" || v === undefined) patch.liquidadoAt = null;
      else if (typeof v === "string") {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Liquidación inválida" }, { status: 400 });
        patch.liquidadoAt = d;
      }
    }
    if ("fechaVencimiento" in body) {
      const v = (body as { fechaVencimiento?: unknown }).fechaVencimiento;
      if (v === null || v === "" || v === undefined) patch.fechaVencimiento = null;
      else if (typeof v === "string") {
        const d = parseCalendarDayOrNull(v.trim());
        if (!d) return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
        patch.fechaVencimiento = d;
      }
    }
    if ("notas" in body) {
      const n = (body as { notas?: unknown }).notas;
      if (n === null || n === undefined) patch.notas = null;
      else if (typeof n === "string") patch.notas = n;
    }

    const m = await actualizarMovimientoProveedor(movId, patch);
    if (!m) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({
      ...m,
      total: Number(m.total),
      precioUnitario: Number(m.precioUnitario),
    });
  } catch (e) {
    const { status, message } = jsonErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { movId } = await params;
  const ok = await eliminarMovimientoProveedor(movId);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "No encontrado" }, { status: 404 });
}

