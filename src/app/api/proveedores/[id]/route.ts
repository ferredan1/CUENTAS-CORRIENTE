import { jsonErrorStatus } from "@/lib/api-errors";
import { requireAuth } from "@/lib/auth-api";
import { actualizarProveedor, eliminarProveedor, obtenerProveedor } from "@/services/proveedores";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  const p = await obtenerProveedor(id);
  if (!p) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const p = await actualizarProveedor(id, body as never);
    if (!p) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(p);
  } catch (e) {
    const { status, message } = jsonErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await eliminarProveedor(id);
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "No encontrado" }, { status: 404 });
}

