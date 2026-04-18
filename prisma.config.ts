import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";
import { findProjectRoot } from "./src/lib/project-root";

/** Misma prioridad que el resto del proyecto: .env del repo sobre variables del sistema. */
config({ path: resolve(findProjectRoot(), ".env"), override: true });

/**
 * Prisma 7 carga esta URL al ejecutar comandos CLI (`migrate deploy`, `db push`, `studio`).
 * `generate` no conecta a la DB; basta una URL bien formada (o el fallback).
 *
 * En Vercel, `db.*.supabase.co:5432` a veces devuelve P1001 (red); Supabase recomienda para migraciones
 * la URI **Session pool** (mismo pooler, puerto **5432**, no 6543). Usá `MIGRATE_DATABASE_URL` con esa URI.
 * El pooler en modo transacción (6543) sigue sin ser ideal para `migrate deploy`.
 * La app en runtime sigue usando `getDatabaseUrl()` en `src/lib/prisma.ts` (pooler 6543 OK).
 */
const DATABASE_URL_FALLBACK =
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma_generate_only?schema=public";

function urlForPrismaCli(): string {
  return (
    process.env.MIGRATE_DATABASE_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    DATABASE_URL_FALLBACK
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: urlForPrismaCli(),
  },
});
