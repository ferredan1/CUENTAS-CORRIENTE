import { requireAuth } from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const sp = req.nextUrl.searchParams;
  const entidad = (sp.get("entidad") ?? "").trim() || null;

  const rows = await prisma.logEliminacion.findMany({
    where: entidad ? { entidad } : {},
    orderBy: { creadoAt: "desc" },
    take: 200,
  });

  return NextResponse.json(rows);
}

