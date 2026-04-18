/**
 * Build en Vercel / local: migraciones + respaldo DDL + prisma generate + next build.
 * @see scripts/migration-safety-net.cjs
 */
const path = require("node:path");
const { spawnSync } = require("node:child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

const ROOT = path.join(__dirname, "..");
const PRISMA_CLI = path.join(ROOT, "node_modules", "prisma", "build", "index.js");

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
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
    cwd: ROOT,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (hasDbUrl()) {
  console.log("[build] prisma migrate deploy (misma invocación que npm run db:deploy)…");
  run(process.execPath, ["-r", path.join(ROOT, "scripts", "dotenv-override.cjs"), PRISMA_CLI, "migrate", "deploy"]);

  console.log("[build] migration-safety-net (DDL directo si faltara la columna)…");
  run(process.execPath, [path.join(ROOT, "scripts", "migration-safety-net.cjs")]);
} else {
  console.warn(
    "[build] Sin DATABASE_URL/DIRECT_URL: se omite migrate deploy. En Vercel producción definí las URLs de Postgres.",
  );
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
