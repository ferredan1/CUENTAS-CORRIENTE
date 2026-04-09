import { requireAuth } from "@/lib/auth-api";
import { buildEstadoCuentaPdfBuffer } from "@/lib/pdf-estado-cuenta";
import { cargarDatosEstadoCuenta } from "@/services/estado-cuenta-data";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: clienteId } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const data = await cargarDatosEstadoCuenta(clienteId, {
    desde: sp.get("desde") ?? undefined,
    hasta: sp.get("hasta") ?? undefined,
    obra: sp.get("obra") ?? undefined,
  });

  if (!data) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const buf = await buildEstadoCuentaPdfBuffer(data);
  const safeName = data.cliente.nombre
    .replace(/[^\w\s.-]/gi, "_")
    .replace(/\s+/g, "_")
    .slice(0, 48);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="estado-cuenta-${safeName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
