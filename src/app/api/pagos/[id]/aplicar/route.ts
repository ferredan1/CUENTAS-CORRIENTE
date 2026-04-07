import { requireAuth } from "@/lib/auth-api";
import { serializePago } from "@/lib/pago-json";
import { aplicarPagoAMovimientos, getPagoConAplicaciones } from "@/services/pagos.service";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const aplicaciones = (body as { aplicaciones?: unknown }).aplicaciones;
  if (!Array.isArray(aplicaciones)) {
    return NextResponse.json({ error: "Se requiere aplicaciones[]" }, { status: 400 });
  }

  const parsed: { movimientoId: string; importeAplicado: number }[] = [];
  for (const raw of aplicaciones) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as { movimientoId?: unknown; importeAplicado?: unknown };
    const movimientoId = typeof o.movimientoId === "string" ? o.movimientoId.trim() : "";
    const importeAplicado = Number(o.importeAplicado);
    if (!movimientoId) continue;
    if (!Number.isFinite(importeAplicado)) {
      return NextResponse.json({ error: "importeAplicado inválido" }, { status: 400 });
    }
    parsed.push({ movimientoId, importeAplicado });
  }

  try {
    await aplicarPagoAMovimientos(id, parsed);
    const pago = await getPagoConAplicaciones(id);
    if (!pago) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(serializePago(pago));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
