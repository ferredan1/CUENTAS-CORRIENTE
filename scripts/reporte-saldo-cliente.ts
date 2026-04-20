/**
 * Saldo de cartera y desglose por obra para un cliente (búsqueda por nombre).
 *
 * Uso (desde la raíz del repo, con `.env` que tenga DATABASE_URL):
 *   node -r ./scripts/dotenv-override.cjs ./node_modules/tsx/dist/cli.mjs scripts/reporte-saldo-cliente.ts "MARCHESAN"
 *
 * O:
 *   npx tsx scripts/reporte-saldo-cliente.ts "RODRIGO"
 *   (si ya exportaste DATABASE_URL en la sesión)
 */

import { formatMoneda } from "../src/lib/format";

async function main() {
  const needle = process.argv.slice(2).join(" ").trim();
  if (!needle) {
    console.error('Uso: npx tsx scripts/reporte-saldo-cliente.ts "fragmento del nombre"');
    process.exit(1);
  }

  const { config } = await import("dotenv");
  const { resolve } = await import("node:path");
  config({ path: resolve(process.cwd(), ".env"), override: true });

  const { prisma } = await import("../src/lib/prisma");
  const { calcularSaldoCarteraYResumenPorObra } = await import("../src/services/saldo-cartera-cliente");

  const todos = await prisma.cliente.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
  const lower = needle.toLowerCase();
  const matches = todos.filter((c) => c.nombre.toLowerCase().includes(lower));
  if (matches.length === 0) {
    console.error(`No hay cliente cuyo nombre contenga «${needle}».`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error("Varios coinciden; sean más específicos:");
    for (const m of matches) console.error(`  - ${m.nombre} (${m.id})`);
    process.exit(1);
  }

  const cliente = matches[0]!;
  const { saldo, resumenPorObra } = await calcularSaldoCarteraYResumenPorObra(cliente.id);
  const nMovs = await prisma.movimiento.count({ where: { clienteId: cliente.id } });

  console.log("---");
  console.log(`Cliente: ${cliente.nombre}`);
  console.log(`ID: ${cliente.id}`);
  console.log(`Movimientos en base: ${nMovs}`);
  console.log("");
  console.log(`SALDO A COBRAR (cartera — lo que te debe): ${formatMoneda(saldo)}`);
  console.log("");
  console.log("Por obra / sin obra:");
  for (const r of resumenPorObra) {
    console.log(`  ${r.orden}. ${r.nombre}  ${formatMoneda(r.saldo)}`);
  }
  const suma = resumenPorObra.reduce((s, r) => s + r.saldo, 0);
  console.log("");
  console.log(`Suma desglose: ${formatMoneda(suma)}`);
  if (Math.abs(suma - saldo) > 0.02) {
    console.warn(`ADVERTENCIA: diferencia suma vs saldo: ${(suma - saldo).toFixed(2)}`);
  }
  console.log("---");

  await prisma.$disconnect();
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
