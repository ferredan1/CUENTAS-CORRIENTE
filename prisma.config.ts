import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";
import { findProjectRoot } from "./src/lib/project-root";

/** Misma prioridad que el resto del proyecto: .env del repo sobre variables del sistema. */
config({ path: resolve(findProjectRoot(), ".env"), override: true });

/**
 * Prisma 7 carga esta URL al ejecutar cualquier comando (incl. `prisma generate`).
 * `env("DATABASE_URL")` falla si falta la variable — típico en CI/Vercel antes de configurar env.
 * `generate` no conecta a la DB; basta una URL PostgreSQL bien formada.
 * En runtime (Vercel, local) debe existir DATABASE_URL real apuntando a tu Postgres.
 */
const DATABASE_URL_FALLBACK =
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma_generate_only?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL?.trim() || DATABASE_URL_FALLBACK,
  },
});
