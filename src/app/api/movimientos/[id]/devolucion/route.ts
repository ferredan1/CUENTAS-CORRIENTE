import { jsonErrorStatus } from "@/lib/api-errors";
import { requireAuth } from "@/lib/auth-api";
import { serializeMovimiento } from "@/lib/movimiento-json";
import { registrarDevolucionSobreVenta } from "@/services/movimientos";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const devolucion = await registrarDevolucionSobreVenta(id);
    return NextResponse.json({ ok: true, devolucion: serializeMovimiento(devolucion) });
  } catch (e) {
    const { status, message } = jsonErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}
