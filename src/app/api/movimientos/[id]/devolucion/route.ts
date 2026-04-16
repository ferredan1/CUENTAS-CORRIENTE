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
    const body = (await _req.json().catch(() => ({}))) as { cantidad?: unknown };
    const cantidad =
      body?.cantidad == null || body.cantidad === ""
        ? undefined
        : Number.isFinite(Number(body.cantidad))
          ? Number(body.cantidad)
          : NaN;
    if (cantidad != null && (!Number.isFinite(cantidad) || !(cantidad > 0))) {
      return NextResponse.json({ error: "Cantidad inválida." }, { status: 400 });
    }

    const devolucion = await registrarDevolucionSobreVenta(id, { cantidad });
    return NextResponse.json({ ok: true, devolucion: serializeMovimiento(devolucion) });
  } catch (e) {
    const { status, message } = jsonErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}
