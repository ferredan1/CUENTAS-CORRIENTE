import { statSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/env-from-dotenv";
import { findProjectRoot } from "@/lib/project-root";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  prismaClientMtimeMs: number | undefined;
  pgPoolConnectionString: string | undefined;
};

function normalizePemCertificate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  // Caso típico Vercel: saltos escapados "\n"
  const unescaped = t.includes("\\n") ? t.replace(/\\n/g, "\n") : t;

  const begin = "-----BEGIN CERTIFICATE-----";
  const end = "-----END CERTIFICATE-----";
  const bi = unescaped.indexOf(begin);
  const ei = unescaped.indexOf(end);
  if (bi < 0 || ei < 0 || ei <= bi) {
    // Si no es PEM, no lo usamos como CA para evitar bloquear el fallback (PG_SSL_NO_VERIFY).
    return null;
  }

  const inside = unescaped
    .slice(bi + begin.length, ei)
    .replace(/[\s\r\n]+/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
  if (!inside) return null;

  const lines: string[] = [];
  for (let i = 0; i < inside.length; i += 64) {
    lines.push(inside.slice(i, i + 64));
  }
  return `${begin}\n${lines.join("\n")}\n${end}\n`;
}

function pgSslOptions(): false | { ca?: string; rejectUnauthorized?: boolean } {
  // En serverless (Vercel) Supabase puede requerir CA explícito (pooler) o fallar con "self-signed certificate".
  // Preferimos validar el certificado con CA provisto por el usuario; como fallback explícito, permitir desactivar
  // la verificación SOLO si el usuario lo habilita por env.
  const noVerify = process.env.PG_SSL_NO_VERIFY?.trim().toLowerCase();
  if (noVerify === "1" || noVerify === "true") {
    return { rejectUnauthorized: false };
  }

  const caRaw = process.env.PG_SSL_CA?.trim();
  if (caRaw) {
    // Vercel puede guardar el PEM en una sola línea o con \n escapados: normalizamos.
    const ca = normalizePemCertificate(caRaw);
    if (ca) return { ca, rejectUnauthorized: true };
  }
  return false;
}

/**
 * Huella del client generado + schema fuente. Usa la raíz del repo (no solo `process.cwd()`),
 * para que coincida con Next/Turbopack cuando el cwd no es la carpeta del proyecto.
 * Tras `prisma generate` o editar `schema.prisma`, el valor cambia y se descarta el singleton viejo
 * (evita `Unknown field …` con un PrismaClient cacheado en `globalThis`).
 */
function prismaGeneratedFingerprint(): number {
  const root = findProjectRoot();
  let max = 0;
  for (const rel of [
    ["node_modules", ".prisma", "client", "index.js"],
    ["node_modules", ".prisma", "client", "schema.prisma"],
    ["prisma", "schema.prisma"],
  ] as const) {
    try {
      max = Math.max(max, statSync(join(root, ...rel)).mtimeMs);
    } catch {
      /* ruta ausente */
    }
  }
  return max;
}

function createPrisma(): PrismaClient {
  const connectionString = getDatabaseUrl();
  const ssl = pgSslOptions();

  if (
    globalForPrisma.pgPool &&
    globalForPrisma.pgPoolConnectionString !== connectionString
  ) {
    void globalForPrisma.pgPool.end().catch(() => {});
    globalForPrisma.pgPool = undefined;
    globalForPrisma.prisma = undefined;
  }

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      ...(ssl ? { ssl } : {}),
    });
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = pool;
    globalForPrisma.pgPoolConnectionString = connectionString;
  }
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaFresh(): PrismaClient {
  const fp = prismaGeneratedFingerprint();
  if (
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prismaClientMtimeMs !== undefined &&
    globalForPrisma.prismaClientMtimeMs !== fp
  ) {
    void globalForPrisma.prisma?.$disconnect();
    globalForPrisma.prisma = undefined;
  }
  globalForPrisma.prismaClientMtimeMs = fp;
  globalForPrisma.prisma ??= createPrisma();
  return globalForPrisma.prisma;
}

const prismaDevProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaFresh();
    const value = Reflect.get(client, prop, client) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export const prisma: PrismaClient =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ??= createPrisma())
    : prismaDevProxy;
