import { requireAuth } from "@/lib/auth-api";
import { serializeMovimientos } from "@/lib/movimiento-json";
import {
  ComprobanteDuplicadoError,
  importarComprobanteVentas,
} from "@/services/importar-comprobante";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as {
      clienteId?: string;
      obraId?: string | null;
      archivoId?: string;
      comprobante?: string;
      items?: {
        codigo: string;
        descripcion: string;
        cantidad: number;
        precioUnitario?: number;
      }[];
      fecha?: string;
    };

    if (!body.clienteId || !body.comprobante?.trim() || !body.archivoId?.trim()) {
      return NextResponse.json(
        { error: "clienteId, archivoId (PDF guardado) y comprobante son obligatorios" },
        { status: 400 },
      );
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items no puede estar vacío" }, { status: 400 });
    }

    const fecha = body.fecha ? new Date(body.fecha) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      return NextResponse.json({ error: "fecha inválida" }, { status: 400 });
    }

    const movimientos = await importarComprobanteVentas({
      clienteId: body.clienteId,
      obraId: body.obraId ?? null,
      archivoId: body.archivoId.trim(),
      comprobante: body.comprobante.trim(),
      fecha,
      items: body.items.map((i) => ({
        codigo: String(i.codigo ?? ""),
        descripcion: String(i.descripcion ?? ""),
        cantidad: Number(i.cantidad ?? 0),
        precioUnitario:
          i.precioUnitario !== undefined && Number.isFinite(Number(i.precioUnitario))
            ? Number(i.precioUnitario)
            : undefined,
      })),
    });

    const serializados = serializeMovimientos(
      movimientos.map((m) => ({ ...m, obra: null })),
    );
    return NextResponse.json({ creados: serializados.length, movimientos: serializados }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = e instanceof ComprobanteDuplicadoError ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
