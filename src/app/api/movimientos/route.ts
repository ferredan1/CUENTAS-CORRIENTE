import { jsonErrorStatus } from "@/lib/api-errors";
import { requireAuth } from "@/lib/auth-api";
import { parseCalendarDayOrNull, parseQueryDayEnd, parseQueryDayStart } from "@/lib/dates";
import { crearMovimientoBodySchema } from "@/lib/schemas/movimiento-api";
import { serializeMovimiento, serializeMovimientos } from "@/lib/movimiento-json";
import { crearMovimiento, listarMovimientos } from "@/services/movimientos";
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
  const tipo = sp.get("tipo") ?? undefined;
  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const data = await listarMovimientos({
    clienteId,
    obraId,
    sinObra,
    desde,
    hasta,
    tipo,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  return NextResponse.json(serializeMovimientos(data));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = crearMovimientoBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const body = parsed.data;

  const tipo = body.tipo ?? "ajuste";

  try {
    let fecha: Date;
    if (body.fecha?.trim()) {
      const d = new Date(body.fecha);
      fecha = Number.isNaN(d.getTime()) ? new Date() : d;
    } else {
      fecha = new Date();
    }

    const m = await crearMovimiento({
      clienteId: body.clienteId,
      obraId: body.obraId ?? null,
      tipo: tipo,
      fecha,
      comprobante: body.comprobante,
      codigoProducto: body.codigoProducto,
      medioPago: body.medioPago?.trim() || null,
      chequeNumero: body.chequeNumero?.trim() || null,
      chequeBanco: (body as { chequeBanco?: string | null }).chequeBanco?.trim() || null,
      chequeVencimiento: parseCalendarDayOrNull(body.chequeVencimiento ?? undefined),
      fechaRecepcion: parseCalendarDayOrNull(body.fechaRecepcion ?? undefined),
      descripcion: body.descripcion ?? "",
      cantidad: body.cantidad,
      precioUnitario: body.precioUnitario,
      archivoId: body.archivoId ?? null,
    });
    return NextResponse.json(serializeMovimiento(m), { status: 201 });
  } catch (e) {
    const { status, message } = jsonErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}
