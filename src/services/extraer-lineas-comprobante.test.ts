import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pdfParse from "pdf-parse";
import { extraerItemsDelTextoComprobante, segmentarComprobantesDesdeTexto } from "./extraer-lineas-comprobante";
import { normalizarTextoExtraidoPdf } from "@/lib/pdf/extract-text";

/** Texto típico pdf-parse de factura Dux (Membranex / Ferretería Dany). */
const TEXTO_MEMBRANEX = `
FACTURA
Nº 00007-00002019
FECHA: 25/03/2026
SUBTOTAL:$3.719,01
Generado por www.duxsoftware.com.ar
Descripción

Cant.Precio Uni.%
Desc
Sub Total %
IVA
Sub Total c/
IVA
BOTON CONCAVO DEALER 420233 332213
1,003.719,010,003.719,0121,004.500,00
`.trim();

describe("extraer-lineas-comprobante", () => {
  it("extrae ítem Dux con columna % IVA (5 montos tras cantidad)", () => {
    const items = extraerItemsDelTextoComprobante(TEXTO_MEMBRANEX);
    expect(items).toHaveLength(1);
    expect(items[0]!.descripcion).toContain("BOTON CONCAVO");
    expect(items[0]!.cantidad).toBe(1);
    expect(items[0]!.precioUnitario).toBeDefined();
  });

  it("segmenta por Nº y conserva texto con ítems", () => {
    const segs = segmentarComprobantesDesdeTexto(TEXTO_MEMBRANEX);
    expect(segs.length).toBeGreaterThanOrEqual(1);
    const items = extraerItemsDelTextoComprobante(segs[0]!.texto);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("PDF real Membranex (Downloads): al menos un ítem", async () => {
    const path = "C:/Users/ferre/Downloads/FacturaMEMBRANEXSAA00007000020197624278981267954302 (1).pdf";
    let buf: Buffer;
    try {
      buf = readFileSync(path);
    } catch {
      return;
    }
    const data = await pdfParse(buf);
    const texto = normalizarTextoExtraidoPdf(typeof data.text === "string" ? data.text : "");
    const segs = segmentarComprobantesDesdeTexto(texto);
    const itemsSeg = extraerItemsDelTextoComprobante(segs[0]!.texto);
    const itemsFull = extraerItemsDelTextoComprobante(texto);
    expect(itemsFull.length).toBeGreaterThan(0);
    expect(itemsSeg.length).toBeGreaterThan(0);
  });
});
