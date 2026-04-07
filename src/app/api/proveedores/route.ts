import { jsonErrorStatus } from "@/lib/api-errors";
import { requireAuth } from "@/lib/auth-api";
import { crearProveedor, listarProveedoresConSaldo } from "@/services/proveedores";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  return NextResponse.json(await listarProveedoresConSaldo(q));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as {
      nombre?: string;
      razonSocial?: string | null;
      cuit?: string | null;
      email?: string | null;
      telefono?: string | null;
      condicionIva?: string | null;
      notas?: string | null;
    };
    const p = await crearProveedor({
      nombre: String(body.nombre ?? ""),
      razonSocial: body.razonSocial ?? null,
      cuit: body.cuit ?? null,
      email: body.email ?? null,
      telefono: body.telefono ?? null,
      condicionIva: body.condicionIva ?? null,
      notas: body.notas ?? null,
    });
    return NextResponse.json(p, { status: 201 });
  } catch (e) {
    const { status, message } = jsonErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}

