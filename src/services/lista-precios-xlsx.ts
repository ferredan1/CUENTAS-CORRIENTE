/**
 * Lectura de listas de precios en Excel (.xlsx): cabeceras variables por proveedor.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { parseNumeroArg } from "./extraer-lineas-comprobante";

export type ProductoListaPrecios = {
  codigo: string;
  descripcion: string;
  precioUnitario: number;
  marca?: string;
  ivaPct?: number;
  proveedorLista: string;
  archivoOrigen: string;
  hoja: string;
  fila: number;
};

export type ResumenArchivoLista = {
  archivo: string;
  hoja: string;
  filas: number;
  advertencias?: string[];
};

export type ConsolidadoListasPrecios = {
  generado: string;
  totalProductos: number;
  porArchivo: ResumenArchivoLista[];
  productos: ProductoListaPrecios[];
};

type HeaderKind = "cod" | "desc" | "precio" | "marca" | "iva" | "otro";

function normSinAcentos(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function celdaATexto(c: unknown): string {
  if (c === null || c === undefined) return "";
  if (typeof c === "number") return Number.isFinite(c) ? String(c) : "";
  return String(c).trim();
}

function celdaANumero(c: unknown): number | null {
  if (typeof c === "number" && Number.isFinite(c)) return c;
  if (typeof c === "string") {
    const n = parseNumeroArg(c);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Clasificación por celda; «articulo» suele ser descripción salvo refinamiento con «detalle». */
function clasificarHeaderBase(c: string): HeaderKind {
  const n = normSinAcentos(c);
  if (!n) return "otro";
  if (n === "iva" || n.includes("tipo iva") || n === "% iva") return "iva";
  if (n.includes("marca") || n.includes("fabricante")) return "marca";
  if (
    /(precio|importe|valor|neto|pvp|lista|costo|unit)/.test(n) &&
    !n.includes("codigo")
  ) {
    return "precio";
  }
  if (n.includes("detalle")) return "desc";
  if (n.includes("herramienta")) return "desc";
  if (n === "articulo") return "desc";
  if (
    /(producto|descripcion|descrip|item|nombre|denominacion)/.test(n)
  ) {
    return "desc";
  }
  if (
    /^c[oó]digo$|^codigo$|^cod\.?$|^art\.?$/.test(n) ||
    n.startsWith("cod_") ||
    n.includes("cod_art")
  ) {
    return "cod";
  }
  return "otro";
}

/**
 * Si hay «articulo» + «detalle» y no hay columna «código» explícita, «articulo» = código (p. ej. LEÓN).
 */
function clasificarTodaLaFila(headerCells: string[]): HeaderKind[] {
  const kinds = headerCells.map(clasificarHeaderBase);
  const n = headerCells.map((h) => normSinAcentos(h));
  const idxDet = n.findIndex((s) => s.includes("detalle"));
  const idxArt = n.findIndex((s) => s === "articulo");
  const idxCodExplicit = n.findIndex(
    (s) =>
      /^c[oó]digo$|^codigo$|^cod\.?$|^art\.?$/.test(s) ||
      s.startsWith("cod_") ||
      s.includes("cod_art"),
  );
  if (idxDet >= 0 && idxArt >= 0 && idxCodExplicit < 0) {
    kinds[idxArt] = "cod";
    kinds[idxDet] = "desc";
  }
  return kinds;
}

function esFilaCabecera(cells: string[]): boolean {
  const kinds = clasificarTodaLaFila(cells);
  return kinds.includes("cod") && kinds.includes("desc") && kinds.includes("precio");
}

function indicesDesdeCabecera(headerCells: string[]): {
  codigo: number;
  descripcion: number;
  precio: number;
  marca?: number;
  ivaPct?: number;
} | null {
  const kinds = clasificarTodaLaFila(headerCells);
  const pick = (k: HeaderKind): number => kinds.indexOf(k);
  const iCod = pick("cod");
  const iDesc = pick("desc");
  const ips: number[] = [];
  headerCells.forEach((_, i) => {
    if (kinds[i] === "precio") ips.push(i);
  });
  if (iCod < 0 || iDesc < 0 || ips.length === 0) return null;
  /** Si hay «Importe final» y «Precio», quedarse con el primero que no sea solo «IVA». */
  let iPrecio = ips[0]!;
  if (ips.length > 1) {
    const preferido = ips.find((i) => {
      const n = normSinAcentos(headerCells[i]!);
      return /(final|neto|unit|lista|precio)/.test(n);
    });
    if (preferido !== undefined) iPrecio = preferido;
  }
  const iMarca = pick("marca");
  const iIva = pick("iva");
  return {
    codigo: iCod,
    descripcion: iDesc,
    precio: iPrecio,
    ...(iMarca >= 0 ? { marca: iMarca } : {}),
    ...(iIva >= 0 ? { ivaPct: iIva } : {}),
  };
}

function matrixDesdeSheet(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
}

function detectarFilaCabecera(matrix: unknown[][]): number {
  const max = Math.min(80, matrix.length);
  for (let i = 0; i < max; i++) {
    const row = matrix[i];
    if (!row || row.length === 0) continue;
    const cells = row.map(celdaATexto);
    if (esFilaCabecera(cells)) return i;
  }
  return -1;
}

export function extraerProductosDeMatrix(
  matrix: unknown[][],
  opts: {
    proveedorLista: string;
    archivoOrigen: string;
    hoja: string;
  },
): { productos: ProductoListaPrecios[]; resumen: ResumenArchivoLista } {
  const advertencias: string[] = [];
  const hi = detectarFilaCabecera(matrix);
  if (hi < 0) {
    advertencias.push("sin fila de cabecera reconocida (Código + Descripción + Precio)");
    return {
      productos: [],
      resumen: {
        archivo: opts.archivoOrigen,
        hoja: opts.hoja,
        filas: 0,
        advertencias,
      },
    };
  }
  const headerRow = matrix[hi]!.map(celdaATexto);
  const idx = indicesDesdeCabecera(headerRow);
  if (!idx) {
    advertencias.push("cabecera detectada pero columnas no resueltas");
    return {
      productos: [],
      resumen: {
        archivo: opts.archivoOrigen,
        hoja: opts.hoja,
        filas: 0,
        advertencias,
      },
    };
  }

  const productos: ProductoListaPrecios[] = [];
  for (let r = hi + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row) continue;
    const cod = celdaATexto(row[idx.codigo]);
    const desc = celdaATexto(row[idx.descripcion]);
    const precRaw = row[idx.precio];
    const precio = celdaANumero(precRaw);
    if (!desc && !cod) continue;
    if (!desc || desc.length < 2) continue;
    if (precio === null || precio < 0) continue;
    const marca =
      idx.marca !== undefined ? celdaATexto(row[idx.marca]) : undefined;
    const ivaRaw =
      idx.ivaPct !== undefined ? row[idx.ivaPct] : undefined;
    let ivaPct: number | undefined;
    if (ivaRaw !== undefined && ivaRaw !== "") {
      const n = celdaANumero(ivaRaw);
      if (n !== null && n >= 0 && n <= 100) ivaPct = n;
    }

    productos.push({
      codigo: cod || "-",
      descripcion: desc,
      precioUnitario: precio,
      ...(marca ? { marca } : {}),
      ...(ivaPct !== undefined ? { ivaPct } : {}),
      proveedorLista: opts.proveedorLista,
      archivoOrigen: opts.archivoOrigen,
      hoja: opts.hoja,
      fila: r + 1,
    });
  }

  return {
    productos,
    resumen: {
      archivo: opts.archivoOrigen,
      hoja: opts.hoja,
      filas: productos.length,
      ...(advertencias.length ? { advertencias } : {}),
    },
  };
}

/**
 * Parsea un workbook .xlsx (buffer) y devuelve productos de todas las hojas con datos.
 */
export function extraerProductosDeXlsxBuffer(
  buffer: Buffer,
  archivoOrigen: string,
  proveedorLista: string,
): { productos: ProductoListaPrecios[]; resumenes: ResumenArchivoLista[] } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const productos: ProductoListaPrecios[] = [];
  const resumenes: ResumenArchivoLista[] = [];

  for (const nombreHoja of wb.SheetNames) {
    const sheet = wb.Sheets[nombreHoja];
    if (!sheet) continue;
    const matrix = matrixDesdeSheet(sheet);
    if (matrix.length === 0) continue;
    const { productos: part, resumen } = extraerProductosDeMatrix(matrix, {
      proveedorLista,
      archivoOrigen,
      hoja: nombreHoja,
    });
    if (part.length > 0) {
      productos.push(...part);
      resumenes.push(resumen);
    } else if (resumen.advertencias?.length) {
      resumenes.push(resumen);
    }
  }

  return { productos, resumenes };
}

/**
 * Recorre un ZIP en memoria, lee cada .xlsx y consolida productos.
 */
export async function consolidarProductosDesdeZipBuffer(
  zipBuffer: Buffer,
): Promise<ConsolidadoListasPrecios> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(zipBuffer);
  const productos: ProductoListaPrecios[] = [];
  const porArchivo: ResumenArchivoLista[] = [];

  const entries = Object.entries(zip.files).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [name, entry] of entries) {
    if (entry.dir) continue;
    const lower = name.toLowerCase();
    if (!lower.endsWith(".xlsx")) continue;
    if (name.includes("__MACOSX") || name.startsWith(".")) continue;
    const buf = await entry.async("nodebuffer");
    const base = path.basename(name);
    const proveedor = base.replace(/\.xlsx$/i, "");
    const { productos: part, resumenes } = extraerProductosDeXlsxBuffer(
      buf,
      name,
      proveedor,
    );
    productos.push(...part);
    porArchivo.push(...resumenes);
  }

  return {
    generado: new Date().toISOString(),
    totalProductos: productos.length,
    porArchivo,
    productos,
  };
}

/**
 * Consolida todos los .xlsx en un directorio (sin ZIP).
 */
export function consolidarProductosDesdeDirectorio(dirAbs: string): ConsolidadoListasPrecios {
  const productos: ProductoListaPrecios[] = [];
  const porArchivo: ResumenArchivoLista[] = [];
  const names = fs.readdirSync(dirAbs).filter((n) => n.toLowerCase().endsWith(".xlsx"));
  const paths = names.map((n) => path.join(dirAbs, n)).sort((a, b) => a.localeCompare(b));
  for (const full of paths) {
    const buf = fs.readFileSync(full);
    const base = path.basename(full);
    const proveedor = base.replace(/\.xlsx$/i, "");
    const { productos: part, resumenes } = extraerProductosDeXlsxBuffer(buf, base, proveedor);
    productos.push(...part);
    porArchivo.push(...resumenes);
  }
  return {
    generado: new Date().toISOString(),
    totalProductos: productos.length,
    porArchivo,
    productos,
  };
}
