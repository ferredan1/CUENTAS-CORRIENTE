import { requireAuth } from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const sp = req.nextUrl.searchParams;
  const entidad = (sp.get("entidad") ?? "").trim();
  const entidadId = (sp.get("entidadId") ?? "").trim();

  if (!entidad || !entidadId) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const rows = await prisma.logCambio.findMany({
    where: { entidad, entidadId },
    orderBy: { creadoAt: "desc" },
    take: 50,
  });

  return NextResponse.json(rows);
}

