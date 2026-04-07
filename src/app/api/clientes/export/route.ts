import { requireAuth } from "@/lib/auth-api";
import { listarClientesConSaldo } from "@/services/clientes";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const rows = await listarClientesConSaldo();

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(
    rows.map((c) => ({
      Nombre: c.nombre,
      Tipo: c.tipo,
      CUIT: c.cuit ?? "",
      Email: c.email ?? "",
      Teléfono: c.telefono ?? "",
      Saldo: c.saldo,
      Estado: (c as { estadoCobranza?: string }).estadoCobranza ?? "",
    })),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  return new NextResponse(out, {
    status: 200,
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="clientes.xlsx"`,
      "cache-control": "no-store",
    },
  });
}

