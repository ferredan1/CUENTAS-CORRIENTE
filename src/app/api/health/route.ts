import { NextResponse } from "next/server";

/** Comprobación rápida en producción: GET /api/health → 200 si el deploy responde (sin DB ni Supabase). */
export async function GET() {
  return NextResponse.json({ ok: true, t: new Date().toISOString() });
}
