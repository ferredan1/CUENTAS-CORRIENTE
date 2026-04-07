import { requireAuth } from "@/lib/auth-api";
import { crearObra, listarObras } from "@/services/obras";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const clienteId = req.nextUrl.searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId requerido" }, { status: 400 });
  }

  const data = await listarObras(clienteId);
  if (data === null) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as { clienteId?: string; nombre?: string };
    const obra = await crearObra(body.clienteId ?? "", body.nombre ?? "");
    if (!obra) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    return NextResponse.json(obra, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
