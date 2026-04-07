import { jsonErrorStatus } from "@/lib/api-errors";
import { requireAuth } from "@/lib/auth-api";
import { parseCalendarDayOrNull, parseQueryDayEnd, parseQueryDayStart } from "@/lib/dates";
import { crearMovimientoProveedor, listarMovimientosProveedor } from "@/services/proveedores";
import type { MovimientoProveedor } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

function serializarMovimientoProveedor(m: MovimientoProveedor) {
  return {
    ...m,
    total: Number(m.total),
    precioUnitario: Number(m.precioUnitario),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  const sp = req.nextUrl.searchParams;

  const movs = await listarMovimientosProveedor(id, {
    desde: parseQueryDayStart(sp.get("desde")) ?? undefined,
    hasta: parseQueryDayEnd(sp.get("hasta")) ?? undefined,
    tipo: sp.get("tipo") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });

  return NextResponse.json(movs.map(serializarMovimientoProveedor));
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const body = (await req.json()) as {
      tipo?: string;
      fecha?: string;
      comprobante?: string | null;
      codigoProducto?: string | null;
      descripcion?: string;
      cantidad?: number;
      precioUnitario?: number;
      archivoId?: string | null;
      fechaVencimiento?: string | null;
      notas?: string | null;
    };

    if (!body.tipo || !body.descripcion || body.cantidad === undefined || body.precioUnitario === undefined) {
      return NextResponse.json(
        { error: "tipo, descripcion, cantidad y precioUnitario son obligatorios" },
        { status: 400 },
      );
    }

    const fecha = body.fecha ? new Date(body.fecha) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }

    let fechaVencimiento: Date | null | undefined;
    if (body.fechaVencimiento !== undefined && body.fechaVencimiento !== null && body.fechaVencimiento !== "") {
      const d = parseCalendarDayOrNull(body.fechaVencimiento.trim());
      if (!d) return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
      fechaVencimiento = d;
    } else if (body.fechaVencimiento === null || body.fechaVencimiento === "") {
      fechaVencimiento = null;
    }

    const m = await crearMovimientoProveedor({
      proveedorId: id,
      tipo: body.tipo,
      fecha,
      comprobante: body.comprobante ?? null,
      codigoProducto: body.codigoProducto ?? null,
      descripcion: body.descripcion,
      cantidad: body.cantidad,
      precioUnitario: body.precioUnitario,
      archivoId: body.archivoId ?? null,
      ...(fechaVencimiento !== undefined ? { fechaVencimiento } : {}),
      ...(body.notas !== undefined ? { notas: body.notas } : {}),
    });

    return NextResponse.json(serializarMovimientoProveedor(m), { status: 201 });
  } catch (e) {
    const { status, message } = jsonErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}

