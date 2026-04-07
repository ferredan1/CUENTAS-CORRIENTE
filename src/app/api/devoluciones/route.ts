import { requireAuth } from "@/lib/auth-api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(_req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  return NextResponse.json(
    {
      error:
        "Las devoluciones ya no se registran desde la app. Usá «Cargar pago» para cobros del cliente.",
    },
    { status: 410 },
  );
}
