import type { EstadoGestionCuenta } from "@prisma/client";
import { requireAuth } from "@/lib/auth-api";
import { actualizarCliente, eliminarCliente, obtenerCliente } from "@/services/clientes";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  const cliente = await obtenerCliente(id);
  if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(cliente);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      nombre?: string;
      tipo?: string;
      nombrePersona?: string | null;
      apellido?: string | null;
      cuit?: string | null;
      email?: string | null;
      telefono?: string | null;
      estadoGestionCuenta?: string;
    };
    const cliente = await actualizarCliente(id, {
      ...body,
      estadoGestionCuenta: body.estadoGestionCuenta as EstadoGestionCuenta | undefined,
    });
    if (!cliente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(cliente);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
  const ok = await eliminarCliente(id);
  if (!ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
