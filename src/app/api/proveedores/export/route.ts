import { requireAuth } from "@/lib/auth-api";
import { listarProveedoresConSaldo } from "@/services/proveedores";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const rows = await listarProveedoresConSaldo();

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(
    rows.map((p) => ({
      Nombre: p.nombre,
      "Razón social": p.razonSocial ?? "",
      CUIT: p.cuit ?? "",
      Email: p.email ?? "",
      Teléfono: p.telefono ?? "",
      Saldo: p.saldo,
      Vencimiento: p.vencimientoReferencia ?? "",
      "Últ. movimiento": p.ultimoMovimientoFecha ?? "",
    })),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Proveedores");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  return new NextResponse(out, {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="proveedores.xlsx"`,
      "cache-control": "no-store",
    },
  });
}

