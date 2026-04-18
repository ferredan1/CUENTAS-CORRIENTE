/**
 * Corrige importes negativos en movimientos pago/devolución (misma lógica que la migración
 * 20260418120000_normaliza_importes_pago_devolucion_positivos).
 *
 * Uso: desde la raíz del repo, con .env que tenga DATABASE_URL o DIRECT_URL (recomendado URL directa 5432):
 *   npm run db:normaliza-importes
 */
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), override: true });

const { Client } = require("pg");

const url =
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_PRISMA_URL?.trim() ||
  process.env.POSTGRES_URL?.trim();

if (!url) {
  console.error(
    "Falta DATABASE_URL o DIRECT_URL. Creá un archivo .env en la raíz del proyecto con la URL de PostgreSQL (Supabase: preferí conexión directa puerto 5432).",
  );
  process.exit(1);
}

const sql = `
UPDATE "Movimiento"
SET
  "total" = ABS("total"),
  "precioUnitario" = ABS("precioUnitario"),
  "updatedAt" = NOW()
WHERE "tipo" IN ('pago', 'devolucion')
  AND ("total" < 0 OR "precioUnitario" < 0);
`;

(async () => {
  const c = new Client({ connectionString: url });
  await c.connect();
  const r = await c.query(sql);
  console.log("Listo. Filas actualizadas:", r.rowCount ?? "(sin dato)");
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
