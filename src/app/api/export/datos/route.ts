import { requireAuth } from "@/lib/auth-api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const [clientes, proveedores, movimientosProveedor, archivosProveedor] = await Promise.all([
    prisma.cliente.findMany(),
    prisma.proveedor.findMany(),
    prisma.movimientoProveedor.findMany(),
    prisma.archivoProveedor.findMany(),
  ]);

  const clienteIds = clientes.map((c) => c.id);
  const [movimientos, archivos] = await Promise.all([
    prisma.movimiento.findMany({ where: { clienteId: { in: clienteIds } } }),
    prisma.archivo.findMany({ where: { clienteId: { in: clienteIds } } }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      exportedAt: new Date().toISOString(),
      clientes,
      movimientos,
      archivos,
      proveedores,
      movimientosProveedor,
      archivosProveedor,
    },
    { status: 200 },
  );
}
