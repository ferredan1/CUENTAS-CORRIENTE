/**
 * Uso local: npx tsx scripts/debug-pdf-items.ts <ruta.pdf>
 */
import { readFileSync } from "node:fs";
import pdfParse from "pdf-parse";
import { normalizarTextoExtraidoPdf } from "../src/lib/pdf/extract-text";
import {
  extraerItemsFormatoDux,
  extraerItemsDelTextoComprobante,
  segmentarComprobantesDesdeTexto,
} from "../src/services/extraer-lineas-comprobante";

const path = process.argv[2];
if (!path) {
  console.error("Uso: npx tsx scripts/debug-pdf-items.ts <ruta.pdf>");
  process.exit(1);
}

void (async () => {
  const buf = readFileSync(path);
  const data = await pdfParse(buf);
  const texto = normalizarTextoExtraidoPdf(typeof data.text === "string" ? data.text : "");
  console.log("length", texto.length);
  const idx = texto.toLowerCase().indexOf("martillo");
  console.log("index martillo", idx);
  const lines = texto.split(/\n/).map((l) => l.trim());
  const li = lines.findIndex((l) => /martillo/i.test(l));
  console.log("line index martillo", li);
  for (let i = Math.max(0, li - 3); i < Math.min(lines.length, li + 14); i++) {
    console.log(i, JSON.stringify(lines[i]));
  }
  const segs = segmentarComprobantesDesdeTexto(texto);
  console.log("segments", segs.length);
  segs.forEach((s, i) => {
    console.log(
      "--- seg",
      i,
      "len",
      s.texto.length,
      "comp",
      s.comprobanteCompleto,
      "martillo",
      /martillo/i.test(s.texto),
    );
  });
  console.log("formatoDux full text items", extraerItemsFormatoDux(texto).length);
  const items = extraerItemsDelTextoComprobante(texto);
  console.log("items count", items.length);
  console.log(JSON.stringify(items, null, 2));
})();
