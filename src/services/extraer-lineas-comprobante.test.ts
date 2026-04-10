import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pdfParse from "pdf-parse";
import {
  extraerItemsDeTramoComprobante,
  extraerItemsDelTextoComprobante,
  segmentarComprobantesDesdeTexto,
} from "./extraer-lineas-comprobante";
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
  it("Dux Factura A: descripción + código alfanum. en línea aparte (F045 / Membranex)", () => {
    const texto = `
FACTURA
Generado por www.duxsoftware.com.ar
Descripción
AKAI LAMPARA DE LED ALTA POTENCIA 35W. E27 L/D 7558
3,004.958,680,0014.876,0321,0018.000,00
DISCO DE CORTE METAL TYROLIT SECUR DE 178 X 1,6 MM. PLANO
F045
25,004.049,590,00101.239,6721,00122.500,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const disco = items.find((it) => it.descripcion.includes("TYROLIT"));
    expect(disco).toBeDefined();
    expect(disco!.descripcion).toContain("F045");
    expect(disco!.cantidad).toBe(25);
    // Subtotal c/IVA → precio unitario efectivo (122.500 / 25), coherente con Factura A Dux.
    expect(disco!.precioUnitario).toBeCloseTo(4900, 1);
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

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

  it("mismo ítem en dos comprobantes en un texto: no colapsar (varios Nº en el mismo PDF)", () => {
    const texto = `
Generado por www.duxsoftware.com.ar
Nº 00007-00004636
FECHA: 16/03/2026
Descripción
MISMO PRODUCTO PRUEBA 999001
1,00100,000,00100,00
Nº 00007-00004647
FECHA: 17/03/2026
Descripción
MISMO PRODUCTO PRUEBA 999001
1,00100,000,00100,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const mismo = items.filter((it) => it.descripcion.includes("MISMO PRODUCTO PRUEBA"));
    expect(mismo).toHaveLength(2);
    expect(mismo[0]!.cantidad).toBe(1);
    expect(mismo[1]!.cantidad).toBe(1);
  });

  it("Dux: cantidad con miles (1.000,00) + descripción con / y comillas (Ferretería Dany)", () => {
    const texto = `
COMPROBANTE
Descripción
CADENA PAT.GALVANIZADA 30(16X12MM)X KG 5231
1,2014.600,000,0017.520,00
TORNILLO AUTOPERFORANTE FLANGEADA AGUJA [01] 08 X 1/2" TFA08013
1.000,0020,000,0020.000,00
MOSQUETON 5 X 50 MM BLN-MOS02
60,00500,000,0030.000,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const tornillo = items.find((it) => it.descripcion.includes("TORNILLO"));
    expect(tornillo).toBeDefined();
    expect(tornillo!.cantidad).toBe(1000);
    expect(tornillo!.precioUnitario).toBe(20);
    expect(tornillo!.descripcion).toContain("1/2");
  });

  it("Dux: descripción en dos líneas (cola corta bajo la línea de importes)", () => {
    const texto = `
Descripción
PINTURA AEROSOL DOBLE A X 350ML COLORES VARIOS DAA0250
1,006.600,000,006.600,00
ROLLO CINTA EMBALAR INCOLORA 48MM X 50MT TOP VALUE EMTOP EMPN1H05 ET-
EMPN1H05
1,001.650,000,001.650,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const rollo = items.find((it) => it.descripcion.includes("ROLLO CINTA"));
    expect(rollo).toBeDefined();
    expect(rollo!.descripcion).toContain("EMPN1H05");
    expect(rollo!.descripcion).toContain("ET-");
    expect(rollo!.cantidad).toBe(1);
    expect(rollo!.precioUnitario).toBe(1650);
    const pintura = items.find((it) => it.descripcion.includes("PINTURA AEROSOL"));
    expect(pintura).toBeDefined();
    expect(pintura!.precioUnitario).toBe(6600);
  });

  it("Dux: descripción multilínea con caracteres especiales (/// ® \" )", () => {
    const texto = `
Descripción
SUSTITUIR POR 7455 [BLISTER 5 UNID] /// ANTES BOQUILLA MAGNETICA WEMBLEY® 7/16" X
65MM 5919
1,002.350,000,002.350,00
ARANDELAS CHAPISTAS GALV. 5/16 X KG. 20
1,005.000,000,005.000,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const boq = items.find((it) => it.descripcion.includes("BOQUILLA"));
    expect(boq).toBeDefined();
    expect(boq!.descripcion).toContain("65MM");
    expect(boq!.descripcion).toContain("///");
    expect(boq!.cantidad).toBe(1);
    expect(boq!.precioUnitario).toBe(2350);
  });

  it("Dux: descripción solo 3 dígitos (460 / 422) como en PDF multi-comprobante", () => {
    const texto = `
Nº 00007-00004912
FECHA: 06/04/2026
Descripción
Sub Total
460
1,008.750,000,008.750,00
422
4,007.600,000,0030.400,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const c460 = items.find((it) => it.descripcion === "460");
    const c422 = items.find((it) => it.descripcion === "422");
    expect(c460).toBeDefined();
    expect(c460!.cantidad).toBe(1);
    expect(c460!.precioUnitario).toBe(8750);
    expect(c422).toBeDefined();
    expect(c422!.cantidad).toBe(4);
    expect(c422!.precioUnitario).toBe(7600);
  });

  it("Dux: ítem cuya descripción es solo código numérico (10100)", () => {
    const texto = `
COMPROBANTE
Descripción
10100
1,003.800,000,003.800,00
ARANDELA PLANA GALVA. 3/8 122G000000F0000
1,001.400,000,001.400,00
`.trim();
    const items = extraerItemsDelTextoComprobante(texto);
    const solo = items.find((it) => it.descripcion.trim() === "10100");
    expect(solo).toBeDefined();
    expect(solo!.cantidad).toBe(1);
    expect(solo!.precioUnitario).toBe(3800);
    expect(items.some((it) => it.descripcion.includes("ARANDELA"))).toBe(true);
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

  it("PDF real Comprobante Dany multi-página: ítems 460 y 422", async () => {
    const path = "C:/Users/ferre/Downloads/Comprobante.7159526418649688829.pdf";
    let buf: Buffer;
    try {
      buf = readFileSync(path);
    } catch {
      return;
    }
    const data = await pdfParse(buf);
    const texto = normalizarTextoExtraidoPdf(typeof data.text === "string" ? data.text : "");
    const items = extraerItemsDelTextoComprobante(texto);
    expect(items.some((it) => it.descripcion === "460")).toBe(true);
    expect(items.some((it) => it.descripcion === "422")).toBe(true);
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
    const itemsSeg = extraerItemsDeTramoComprobante(segs[0]!.texto);
    const itemsFull = extraerItemsDelTextoComprobante(texto);
    expect(itemsFull.length).toBeGreaterThan(0);
    expect(itemsSeg.length).toBeGreaterThan(0);
  });
});
