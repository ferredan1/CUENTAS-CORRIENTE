import { requireAuth } from "@/lib/auth-api";
import { eliminarArchivo } from "@/services/archivos";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await params;
  const ok = await eliminarArchivo(id);
  if (!ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
