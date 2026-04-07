import { requireAuth } from "@/lib/auth-api";
import { actualizarObra, eliminarObra } from "@/services/obras";
import type { EstadoGestionCuenta } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const body = (await req.json()) as { estadoGestionCuenta?: string };
    const obra = await actualizarObra(id, {
      estadoGestionCuenta: body.estadoGestionCuenta as EstadoGestionCuenta | undefined,
    });
    if (!obra) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(obra);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await eliminarObra(id);
  if (!ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
