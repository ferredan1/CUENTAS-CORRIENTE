import { requireAuth } from "@/lib/auth-api";
import { serializePago } from "@/lib/pago-json";
import { getPagoConAplicaciones } from "@/services/pagos.service";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const pago = await getPagoConAplicaciones(id);
  if (!pago) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(serializePago(pago));
}
