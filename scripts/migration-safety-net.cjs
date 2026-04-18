/**
 * Si `migrate deploy` no pudo aplicar migraciones (pooler, timeout, etc.) pero el código ya espera
 * el schema nuevo, aplica de forma idempotente la migración crítica usando conexión **directa** (DIRECT_URL).
 * Luego marca la migración como aplicada en `_prisma_migrations`.
 *
 * Solo actúa si falta la columna `devolucionVentaOrigenId`. Requiere DIRECT_URL (o URL sin pooler).
 */
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

const ROOT = path.join(__dirname, "..");

function directPostgresUrl() {
  const a =
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim();
  if (a) return a;
  const db = process.env.DATABASE_URL?.trim();
  // Solo si parece conexión directa (no pooler 6543): el DDL no conviene vía PgBouncer.
  if (db && !db.includes("pooler.supabase.com") && !db.includes(":6543")) {
    return db;
  }
  return undefined;
}

const MIGRATION_NAME = "20260417120000_movimiento_devolucion_venta_origen";

async function columnExists(client, name) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'Movimiento' AND column_name = $1 LIMIT 1`,
    [name],
  );
  return r.rows.length > 0;
}

async function main() {
  const url = directPostgresUrl();
  if (!url) {
    console.warn(
      "[migration-safety-net] Sin DIRECT_URL (ni URL sin pooler): no se puede aplicar DDL de respaldo. " +
        "Definí DIRECT_URL en Vercel (puerto 5432, host db.*.supabase.co).",
    );
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  let appliedDdl = false;
  try {
    if (await columnExists(client, "devolucionVentaOrigenId")) {
      console.log("[migration-safety-net] OK: columna devolucionVentaOrigenId presente.");
      return;
    }

    console.log("[migration-safety-net] Aplicando DDL de respaldo (devolucionVentaOrigenId)…");

    await client.query("BEGIN");
    await client.query(
      `ALTER TABLE "Movimiento" ADD COLUMN IF NOT EXISTS "devolucionVentaOrigenId" TEXT`,
    );

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Movimiento_devolucionVentaOrigenId_fkey'
        ) THEN
          ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_devolucionVentaOrigenId_fkey"
            FOREIGN KEY ("devolucionVentaOrigenId") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await client.query(
      `CREATE INDEX IF NOT EXISTS "Movimiento_devolucionVentaOrigenId_idx" ON "Movimiento"("devolucionVentaOrigenId")`,
    );

    await client.query(`
      UPDATE "Movimiento" AS d
      SET "devolucionVentaOrigenId" = v.id
      FROM "Movimiento" AS v
      WHERE d."tipo" = 'devolucion'
        AND d."devolucionVentaOrigenId" IS NULL
        AND v."tipo" = 'venta'
        AND v."clienteId" = d."clienteId"
        AND v."obraId" IS NOT DISTINCT FROM d."obraId"
        AND v."comprobante" IS NOT DISTINCT FROM d."comprobante"
        AND d."descripcion" LIKE 'Devolución%'
    `);

    await client.query("COMMIT");
    appliedDdl = true;
    console.log("[migration-safety-net] DDL de respaldo aplicado.");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    await client.end();
  }

  if (!appliedDdl) {
    return;
  }

  console.log(`[migration-safety-net] Marcando migración ${MIGRATION_NAME} como aplicada…`);
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prisma", "migrate", "resolve", "--applied", MIGRATION_NAME],
    {
      encoding: "utf8",
      shell: true,
      cwd: ROOT,
      env: process.env,
    },
  );
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    const msg = `${r.stderr || ""}${r.stdout || ""}`;
    if (/P3008|already|recorded as applied|Migration.*already/i.test(msg)) {
      console.warn("[migration-safety-net] migrate resolve: migración ya estaba registrada (ok).");
      return;
    }
    console.error("[migration-safety-net] migrate resolve falló. Revisá logs arriba.");
    process.exit(r.status ?? 1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
