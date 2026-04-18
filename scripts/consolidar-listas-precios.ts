/**
 * Consolida todos los .xlsx de un ZIP o de un directorio en un JSON único.
 *
 * Uso:
 *   npx tsx scripts/consolidar-listas-precios.ts "C:\\ruta\\listas.zip" --out productos.json
 *   npx tsx scripts/consolidar-listas-precios.ts "C:\\ruta\\carpeta" --out productos.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  consolidarProductosDesdeDirectorio,
  consolidarProductosDesdeZipBuffer,
} from "../src/services/lista-precios-xlsx";

async function main() {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf("--out");
  let outPath: string | null = null;
  if (outIdx >= 0 && argv[outIdx + 1]) {
    outPath = path.resolve(argv[outIdx + 1]!);
    argv.splice(outIdx, 2);
  }
  const input = argv.find((a) => !a.startsWith("-"));
  if (!input) {
    console.error(
      "Uso: npx tsx scripts/consolidar-listas-precios.ts <archivo.zip|carpeta> [--out salida.json]",
    );
    process.exit(1);
  }
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) {
    console.error("No existe:", resolved);
    process.exit(1);
  }

  let data;
  const st = fs.statSync(resolved);
  if (st.isDirectory()) {
    data = consolidarProductosDesdeDirectorio(resolved);
  } else if (resolved.toLowerCase().endsWith(".zip")) {
    const buf = fs.readFileSync(resolved);
    data = await consolidarProductosDesdeZipBuffer(buf);
  } else {
    console.error("Indicá un .zip o una carpeta con archivos .xlsx");
    process.exit(1);
  }

  const json = JSON.stringify(data, null, 2);
  if (outPath) {
    fs.writeFileSync(outPath, json, "utf-8");
    console.error("Escrito:", outPath);
  } else {
    process.stdout.write(json);
  }
  console.error(
    `Total productos: ${data.totalProductos} (archivos hoja con filas: ${data.porArchivo.filter((x) => x.filas > 0).length})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
