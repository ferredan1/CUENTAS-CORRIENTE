import { requireAuth } from "@/lib/auth-api";
import { listarArchivosPorCliente } from "@/services/archivos";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const clienteId = req.nextUrl.searchParams.get("clienteId") ?? "";
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId requerido" }, { status: 400 });
  }

  const lista = await listarArchivosPorCliente(clienteId);
  if (!lista) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  return NextResponse.json(
    lista.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      url: a.url,
      createdAt: a.createdAt,
      obraNombre: a.obra?.nombre ?? null,
    })),
  );
}
