/**
 * Índice de productos desde listas Excel (código + descripción) para enriquecer
 * la extracción de PDF: descripciones canónicas y códigos al cargar comprobantes.
 * No usa precios del catálogo en la lógica de matching.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export type FilaCatalogoJson = {
  codigo: string;
  descripcion: string;
  proveedorLista?: string;
  precioUnitario?: number;
};

export type EntradaCatalogo = {
  codigo: string;
  descripcion: string;
  descripcionNorm: string;
  proveedorLista?: string;
};

export type CatalogIndex = {
  /** descripcion normalizada → una entrada representativa */
  exacto: Map<string, EntradaCatalogo>;
  /** primera palabra significativa → candidatos (ordenados por descripción larga primero) */
  porPalabra: Map<string, EntradaCatalogo[]>;
};

const STOP = new Set([
  "de",
  "la",
  "el",
  "los",
  "las",
  "y",
  "con",
  "para",
  "por",
  "sin",
  "un",
  "una",
  "en",
  "al",
  "del",
]);

/** Normaliza para comparar PDF vs catálogo (sin ®/™, colapsa espacios). */
export function normalizarTextoProducto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[®™]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function primeraPalabraClave(descripcion: string): string {
  const parts = normalizarTextoProducto(descripcion)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return parts[0] ?? "";
}

function segundaPalabraClave(descripcion: string): string {
  const parts = normalizarTextoProducto(descripcion)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return parts[1] ?? "";
}

/**
 * Construye índice desde filas del JSON de `catalogo:consolidar` (campo `productos`).
 */
export function buildCatalogIndex(
  filas: Array<Pick<FilaCatalogoJson, "codigo" | "descripcion" | "proveedorLista">>,
): CatalogIndex {
  const exacto = new Map<string, EntradaCatalogo>();
  const porPalabra = new Map<string, EntradaCatalogo[]>();

  for (const r of filas) {
    const des = (r.descripcion ?? "").trim();
    if (des.length < 2) continue;
    const descripcionNorm = normalizarTextoProducto(des);
    if (descripcionNorm.length < 4) continue;

    const entrada: EntradaCatalogo = {
      codigo: String(r.codigo ?? "").trim() || "-",
      descripcion: des,
      descripcionNorm,
      proveedorLista: r.proveedorLista,
    };

    if (!exacto.has(descripcionNorm)) {
      exacto.set(descripcionNorm, entrada);
    }

    for (const kw of [
      primeraPalabraClave(des),
      segundaPalabraClave(des),
    ].filter(Boolean)) {
      if (!porPalabra.has(kw)) porPalabra.set(kw, []);
      porPalabra.get(kw)!.push(entrada);
    }
  }

  const porPalabraOrdenado = new Map<string, EntradaCatalogo[]>();
  for (const [kw, arr] of porPalabra) {
    const seen = new Set<string>();
    const dedup: EntradaCatalogo[] = [];
    for (const e of arr.sort((a, b) => b.descripcionNorm.length - a.descripcionNorm.length)) {
      const k = `${e.descripcionNorm}|${e.codigo}`;
      if (seen.has(k)) continue;
      seen.add(k);
      dedup.push(e);
    }
    porPalabraOrdenado.set(kw, dedup);
  }

  return { exacto, porPalabra: porPalabraOrdenado };
}

export type MatchCatalogo =
  | { tipo: "exacta"; entrada: EntradaCatalogo }
  | { tipo: "pdf_contiene_catalogo"; entrada: EntradaCatalogo }
  | { tipo: "catalogo_contiene_pdf"; entrada: EntradaCatalogo };

const MIN_SUBSTRING = 10;

function candidatosParaTexto(
  textoPdfNorm: string,
  index: CatalogIndex,
): EntradaCatalogo[] {
  const k1 = primeraPalabraClave(textoPdfNorm);
  const k2 = segundaPalabraClave(textoPdfNorm);
  const out: EntradaCatalogo[] = [];
  const seen = new Set<string>();
  for (const k of [k1, k2]) {
    if (!k) continue;
    const list = index.porPalabra.get(k) ?? [];
    for (const e of list) {
      const id = `${e.descripcionNorm}|${e.codigo}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(e);
    }
  }
  return out;
}

/**
 * Encuentra la mejor entrada de catálogo para una descripción ya extraída del PDF.
 */
export function emparejarDescripcionConCatalogo(
  descripcionPdf: string,
  index: CatalogIndex,
): MatchCatalogo | null {
  const t = normalizarTextoProducto(descripcionPdf);
  if (t.length < 4) return null;

  const ex = index.exacto.get(t);
  if (ex) return { tipo: "exacta", entrada: ex };

  const candidatos = candidatosParaTexto(t, index);
  let mejor: { entrada: EntradaCatalogo; score: number; tipo: MatchCatalogo["tipo"] } | null =
    null;

  for (const e of candidatos) {
    const cn = e.descripcionNorm;
    if (cn.length < MIN_SUBSTRING) continue;
    if (t.includes(cn)) {
      const score = cn.length;
      if (!mejor || score > mejor.score) {
        mejor = { entrada: e, score, tipo: "pdf_contiene_catalogo" };
      }
    }
  }

  if (mejor) return { tipo: mejor.tipo, entrada: mejor.entrada };

  for (const e of candidatos) {
    const cn = e.descripcionNorm;
    if (t.length >= MIN_SUBSTRING && cn.includes(t)) {
      const score = t.length;
      if (!mejor || score > mejor.score) {
        mejor = { entrada: e, score, tipo: "catalogo_contiene_pdf" };
      }
    }
  }

  return mejor ? { tipo: mejor.tipo, entrada: mejor.entrada } : null;
}

let cacheIndex: CatalogIndex | null | undefined;

/**
 * Lee `CATALOGO_PRODUCTOS_JSON` (ruta absoluta o relativa al cwd), parsea `{ productos: [...] }` y cachea el índice.
 */
export function getCatalogoProductosIndex(): CatalogIndex | null {
  if (cacheIndex !== undefined) return cacheIndex;
  const p = process.env.CATALOGO_PRODUCTOS_JSON?.trim();
  if (!p) {
    cacheIndex = null;
    return null;
  }
  const resolved = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  if (!fs.existsSync(resolved)) {
    console.warn("[catalogo] Archivo no encontrado:", resolved);
    cacheIndex = null;
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(resolved, "utf-8")) as {
      productos?: FilaCatalogoJson[];
    };
    const filas = raw.productos ?? [];
    cacheIndex = buildCatalogIndex(filas);
    return cacheIndex;
  } catch (e) {
    console.warn("[catalogo] No se pudo cargar:", e);
    cacheIndex = null;
    return null;
  }
}

/** Tests o recarga tras generar otro JSON */
export function resetCatalogoProductosIndexCache(): void {
  cacheIndex = undefined;
}

/** Misma forma que `ItemExtraido` (evita import circular con extraer-lineas-comprobante). */
export type ItemExtraidoLike = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario?: number;
};

/**
 * Tras el parser Dux, alinea descripción y código con el catálogo (mismas listas Excel que generaron el JSON).
 */
export function enriquecerItemsConCatalogo<T extends ItemExtraidoLike>(
  items: T[],
  index: CatalogIndex,
): T[] {
  return items.map((it) => {
    const m = emparejarDescripcionConCatalogo(it.descripcion, index);
    if (!m) return it;
    const cod =
      m.entrada.codigo && m.entrada.codigo !== "-"
        ? m.entrada.codigo
        : it.codigo && it.codigo !== "-"
          ? it.codigo
          : m.entrada.codigo;
    return {
      ...it,
      codigo: cod,
      descripcion: m.entrada.descripcion,
    };
  });
}
