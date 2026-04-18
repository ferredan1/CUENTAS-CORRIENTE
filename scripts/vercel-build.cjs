/**
 * Build en Vercel / local: aplica migraciones pendientes antes de generar el client y Next.
 * Sin esto, el schema de Prisma puede incluir columnas que la DB en Supabase aún no tiene → 500 en runtime.
 *
 * Requiere en el entorno (Vercel → Environment Variables): DIRECT_URL o DATABASE_URL válidos.
 * Para Supabase: preferí URL directa :5432 en DIRECT_URL para migraciones (ver prisma.config.ts).
 */
const path = require("node:path");
const { spawnSync } = require("node:child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

function hasDbUrl() {
  return Boolean(
    process.env.DIRECT_URL?.trim() ||
      process.env.DATABASE_URL_UNPOOLED?.trim() ||
      process.env.POSTGRES_URL_NON_POOLING?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_PRISMA_URL?.trim() ||
      process.env.POSTGRES_URL?.trim(),
  );
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: process.env });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (hasDbUrl()) {
  console.log("[build] Aplicando migraciones (prisma migrate deploy)…");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.warn(
    "[build] Sin DATABASE_URL/DIRECT_URL: se omite migrate deploy. En Vercel producción definí al menos una URL de Postgres.",
  );
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
