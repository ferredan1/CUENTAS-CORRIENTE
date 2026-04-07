import { jsonErrorStatus } from "@/lib/api-errors";
import { parseCalendarDayOrNull } from "@/lib/dates";
import { requireAuth } from "@/lib/auth-api";
import { serializeMovimiento } from "@/lib/movimiento-json";
import { actualizarMovimiento, eliminarMovimiento } from "@/services/movimientos";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  type Patch = Parameters<typeof actualizarMovimiento>[1];
  const patch: Patch = {};

  if ("fecha" in body) {
    if (body.fecha === null || body.fecha === undefined) {
      /* omitir: no se envía borrado de fecha */
    } else if (typeof body.fecha === "string") {
      const fecha = new Date(body.fecha);
      if (Number.isNaN(fecha.getTime())) {
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
      }
      patch.fecha = fecha;
    }
  }

  if ("comprobante" in body) {
    patch.comprobante =
      body.comprobante === null ? null : typeof body.comprobante === "string" ? body.comprobante : null;
  }
  if ("codigoProducto" in body) {
    patch.codigoProducto =
      body.codigoProducto === null
        ? null
        : typeof body.codigoProducto === "string"
          ? body.codigoProducto
          : null;
  }
  if ("medioPago" in body) {
    patch.medioPago =
      body.medioPago === null || body.medioPago === undefined
        ? null
        : String(body.medioPago);
  }
  if ("chequeNumero" in body) {
    patch.chequeNumero =
      body.chequeNumero === null || body.chequeNumero === undefined
        ? null
        : String(body.chequeNumero);
  }
  if ("chequeBanco" in body) {
    patch.chequeBanco =
      body.chequeBanco === null || body.chequeBanco === undefined
        ? null
        : String(body.chequeBanco);
  }
  if ("descripcion" in body && typeof body.descripcion === "string") {
    patch.descripcion = body.descripcion;
  }
  if ("notas" in body) {
    const n = body.notas;
    if (n === null || n === undefined) patch.notas = null;
    else if (typeof n === "string") patch.notas = n;
  }
  if ("cantidad" in body && typeof body.cantidad === "number") {
    patch.cantidad = body.cantidad;
  }
  if ("precioUnitario" in body && typeof body.precioUnitario === "number") {
    patch.precioUnitario = body.precioUnitario;
  }
  if ("tipo" in body && typeof body.tipo === "string") {
    patch.tipo = body.tipo;
  }
  if ("obraId" in body) {
    if (body.obraId === null) patch.obraId = null;
    else if (typeof body.obraId === "string") patch.obraId = body.obraId;
  }

  if ("chequeVencimiento" in body) {
    const v = body.chequeVencimiento;
    patch.chequeVencimiento =
      v === null || v === "" ? null : parseCalendarDayOrNull(String(v));
    if (v !== null && v !== "" && patch.chequeVencimiento === null) {
      return NextResponse.json({ error: "Fecha de cheque inválida" }, { status: 400 });
    }
  }
  if ("fechaRecepcion" in body) {
    const v = body.fechaRecepcion;
    patch.fechaRecepcion = v === null || v === "" ? null : parseCalendarDayOrNull(String(v));
    if (v !== null && v !== "" && patch.fechaRecepcion === null) {
      return NextResponse.json({ error: "Fecha de recepción inválida" }, { status: 400 });
    }
  }

  if ("estadoCheque" in body) {
    const v = (body as { estadoCheque?: unknown }).estadoCheque;
    if (v === null || v === "" || v === undefined) patch.estadoCheque = null;
    else if (typeof v === "string") patch.estadoCheque = v;
  }

  if ("liquidadoAt" in body) {
    const v = (body as { liquidadoAt?: unknown }).liquidadoAt;
    if (v === null || v === "" || v === undefined) {
      patch.liquidadoAt = null;
    } else if (typeof v === "string") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Liquidación inválida" }, { status: 400 });
      }
      patch.liquidadoAt = d;
    }
  }

  try {
    const m = await actualizarMovimiento(id, patch);
    if (!m) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(serializeMovimiento(m));
  } catch (e) {
    const { status, message } = jsonErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await eliminarMovimiento(id);
  if (!ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
