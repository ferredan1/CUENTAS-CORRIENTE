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

  it("en Dux toma solo la descripción inmediata para evitar fusionar ítems", () => {
    const texto = `
FACTURA
Descripción
TORNILLO AUTOPERFORANTE FLANGEADA AGUJA [01] 08 X 1/2
MOSQUETON 5 X 50 MM BLN-MOS02
60,00500,000,0030.000,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    expect(items).toHaveLength(1);
    expect(items[0]!.descripcion).toBe("MOSQUETON 5 X 50 MM BLN-MOS02");
    expect(items[0]!.cantidad).toBe(60);
  });

  it("Dux: descripción larga + código en línea aparte antes de importes pegados (TERSEN / pdf-parse)", () => {
    const texto = `
FACTURA
Descripción
LIJA AL AGUA [GRANO 150] X 25 UNI BREMEN 7567
7,00900,000,006.300,00
TERSEN LATEX ACRILICO EXTERIOR/INTERIOR X 10 LTS ***AHORA SUBMARCA TERSEN***
3568
1,0096.600,000,0096.600,00
REMOTUTTO REMOVEDOR GEL 1 KG 1015
1,0011.550,000,0011.550,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const tersen = items.find((it) => it.descripcion.includes("TERSEN"));
    expect(tersen).toBeDefined();
    expect(tersen!.descripcion).toContain("3568");
    expect(tersen!.cantidad).toBe(1);
    expect(tersen!.precioUnitario).toBe(96600);
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("Dux: no confundir DESCARGA… con encabezado «Desc» (Ferretería Dany)", () => {
    const texto = `
COMPROBANTE
Nº 00007-00004774
Generado por www.duxsoftware.com.ar
Descripción
ARTICULO 42000 VALVULA ENTRADA AGUA IDEAL MOTTA 332205
1,009.750,000,009.750,00
DESCARGA APOYO TIPO ROCA NACIONAL 332062
1,0015.600,000,0015.600,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const descarga = items.find((it) => it.descripcion.includes("DESCARGA"));
    expect(descarga).toBeDefined();
    expect(descarga!.precioUnitario).toBe(15600);
    expect(items.length).toBeGreaterThanOrEqual(2);
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
