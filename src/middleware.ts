/**
 * Sesión Supabase y protección de `/dashboard`.
 * Usamos `middleware.ts` (convención clásica) para máxima compatibilidad con el runtime de Vercel;
 * la lógica vive en `@/lib/supabase/middleware`.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
