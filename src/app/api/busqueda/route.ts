import { normalizarComprobanteParaDuplicado } from "@/domain/comprobantes/normalize";
import { requireAuth } from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const LIMIT = 25;

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ clientes: [], proveedores: [] });
  }

  const norm = normalizarComprobanteParaDuplicado(q);

  const [movCliente, movProv] = await Promise.all([
    prisma.movimiento.findMany({
      where: {
        OR: [
          { comprobante: { contains: q, mode: "insensitive" } },
          ...(norm.length >= 2 ? [{ normalizedComprobante: norm }] : []),
        ],
      },
      select: {
        id: true,
        comprobante: true,
        tipo: true,
        fecha: true,
        cliente: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take: LIMIT,
    }),
    prisma.movimientoProveedor.findMany({
      where: {
        OR: [
          { comprobante: { contains: q, mode: "insensitive" } },
          ...(norm.length >= 2 ? [{ normalizedComprobante: norm }] : []),
        ],
      },
      select: {
        id: true,
        comprobante: true,
        tipo: true,
        fecha: true,
        proveedor: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: "desc" },
      take: LIMIT,
    }),
  ]);

  return NextResponse.json({
    clientes: movCliente.map((m) => ({
      movimientoId: m.id,
      comprobante: m.comprobante,
      tipo: m.tipo,
      fecha: m.fecha.toISOString(),
      clienteId: m.cliente.id,
      clienteNombre: m.cliente.nombre,
    })),
    proveedores: movProv.map((m) => ({
      movimientoId: m.id,
      comprobante: m.comprobante,
      tipo: m.tipo,
      fecha: m.fecha.toISOString(),
      proveedorId: m.proveedor.id,
      proveedorNombre: m.proveedor.nombre,
    })),
  });
}
