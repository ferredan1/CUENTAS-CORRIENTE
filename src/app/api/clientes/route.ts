import { requireAuth } from "@/lib/auth-api";
import {
  crearCliente,
  listarClientesConSaldo,
  listarClientesConSaldoPaginated,
  listarClientesParaTabla,
  parseFiltroClientesTabla,
  parseOrdenClientesTabla,
} from "@/services/clientes";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;
  const pageMode = searchParams.get("pageMode");
  const listMode = searchParams.get("listMode");

  if (pageMode === "cursor") {
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 80;
    const cursor = searchParams.get("cursor");
    if (listMode === "tabla") {
      const filtro = parseFiltroClientesTabla(searchParams.get("filtro"));
      const orderBy = parseOrdenClientesTabla(searchParams.get("orderBy"));
      const { clientes, nextCursor } = await listarClientesParaTabla({
        busqueda: q ?? undefined,
        filtro,
        orderBy,
        limit: Number.isFinite(limit) ? limit : 80,
        cursor,
      });
      return NextResponse.json({ clientes, nextCursor });
    }
    const { clientes, nextCursor } = await listarClientesConSaldoPaginated(
      q ?? undefined,
      limit,
      cursor,
    );
    return NextResponse.json({ clientes, nextCursor });
  }

  const data = await listarClientesConSaldo(q);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = (await req.json()) as {
      nombre?: string;
      tipo?: string;
      nombrePersona?: string | null;
      apellido?: string | null;
      cuit?: string | null;
      email?: string | null;
      telefono?: string | null;
    };
    const cliente = await crearCliente({
      nombre: body.nombre ?? "",
      tipo: body.tipo ?? "",
      nombrePersona: body.nombrePersona,
      apellido: body.apellido,
      cuit: body.cuit,
      email: body.email,
      telefono: body.telefono,
    });
    return NextResponse.json(cliente, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
