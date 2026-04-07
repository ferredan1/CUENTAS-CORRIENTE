/**
 * Next.js 16: el archivo `proxy.ts` reemplaza a `middleware.ts` para el límite de red.
 * Aquí se renueva la sesión de Supabase y se redirige a /login si no hay usuario en /dashboard.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};

