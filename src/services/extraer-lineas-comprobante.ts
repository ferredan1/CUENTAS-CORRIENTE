/**
 * Heurísticas sobre texto plano extraído del PDF.
 * Incluye formato Dux (duxsoftware.com.ar): línea de descripción + línea cant|P.U.|%Desc|Subt pegadas.
 */

export type ItemExtraido = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  /** Precio unitario del comprobante (ARS), si se pudo inferir */
  precioUnitario?: number;
};

export type SegmentoComprobante = {
  texto: string;
  comprobante: string;
  fecha: Date | null;
  letra: "A" | "B" | "C" | "X" | null;
  comprobanteCompleto: string;
  cae: string | null;
  caeFechaVto: Date | null;
  cuitCliente: string | null;
};

export function parseNumeroArg(s: string): number {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (t.includes(",") && t.includes(".")) {
    return Number.parseFloat(t.replace(/\./g, "").replace(",", "."));
  }
  if (t.includes(",")) return Number.parseFloat(t.replace(",", "."));
  return Number.parseFloat(t);
}

/**
 * Cant, P.U., % desc, subtotal pegados.
 * Cada monto AR: miles con punto o entero simple (incluye ceros a la izquierda p. ej. 00125,00).
 */
const RE_DUX_LINEA_IMPORTES =
  /^(\d+,\d{2})(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})$/;

/** Cant., P.U., % desc, subtotal al final de la misma línea que la descripción (muchos PDF Dux). */
const RE_DUX_COLA_CON_ESPACIOS =
  /(\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})\s*$/;

/**
 * Código al inicio del renglón: MARCA-12345 - descripción (p. ej. factura A con ítems detallados).
 */
const RE_CODIGO_CON_PREFIJO_EN_LINEA =
  /^\s*([A-Z0-9][\w.-]*-[A-Za-z0-9][\w.-]*)\s*-\s+/i;

/** Despeja montos AR pegados: primero miles con punto, si no «dígitos,dec». */
function parsearImportesPelando(line: string): { cant: string; amounts: string[] } | null {
  const cm = line.match(/^(\d+,\d{2})/);
  if (!cm) return null;
  let r = line.slice(cm[0].length);
  const amounts: string[] = [];
  while (r.length > 0) {
    const longM = r.match(/^\d{1,3}(?:\.\d{3})+,\d{2}/);
    const piece = longM?.[0] ?? r.match(/^\d+,\d{2}/)?.[0];
    if (!piece) return null;
    amounts.push(piece);
    r = r.slice(piece.length);
  }
  if (amounts.length === 0) return null;
  return { cant: cm[1]!, amounts };
}

function esLineaSoloImportesDux(line: string): boolean {
  if (RE_DUX_LINEA_IMPORTES.test(line)) return true;
  const p = parsearImportesPelando(line);
  return p !== null && p.amounts.length === 5;
}

function recolectarBloqueDescripcion(lineas: string[], idxImportes: number): string | null {
  const partes: string[] = [];
  for (let j = idxImportes - 1; j >= 0; j--) {
    const L = lineas[j]!;
    if (!L) continue;
    if (lineaPareceEncabezadoOlegal(L)) break;
    if (esLineaSoloImportesDux(L)) break;
    partes.unshift(L.trim());
  }
  if (partes.length === 0) return null;
  return partes.join(" ");
}

function codigoDesdeDescripcionRenglon(
  desc: string,
  inferirOpts?: OpcionesInferirCodigo,
): string {
  const t = desc.trim();
  const pref = t.match(RE_CODIGO_CON_PREFIJO_EN_LINEA);
  if (pref) return pref[1]!;
  return inferirCodigoProductoDesdeLinea(t, inferirOpts);
}

function lineaPareceEncabezadoOlegal(line: string): boolean {
  const l = line.trim().toLowerCase();
  if (l.length < 5) return true;
  return (
    /^(cant\.?|cod\.|cód|producto|descrip|detalle|precio|p\.?\s*unit|%|desc\.?|sub\s*tot|importe|subtotal|total|iva|factura|remito|comprobante|cuit|cuil|tipo\s|n[°º]|nro|fecha|vto|venc|cliente|domicilio|tel\.?|email|condici|iibb|ing\.?\s*brutos)/i.test(
      l.slice(0, 32),
    ) ||
    /^\s*página\s*\d/i.test(l) ||
    /^generado\s+por\b/i.test(l)
  );
}

/** Reservado para futuras opciones de inferencia de código desde el texto del comprobante. */
export type OpcionesInferirCodigo = Record<string, never>;

/** Evita tomar un número suelto del medio de la descripción como SKU. */
function codigoSoloDigitosValido(code: string, descLen: number): boolean {
  if (!/^\d+$/.test(code)) return true;
  const n = code.length;
  if (n >= 5) return descLen >= 4;
  if (n >= 3) return descLen >= 6;
  return descLen >= 10;
}

/**
 * Código de artículo inferido para el campo `codigoProducto`, sin modificar el texto completo.
 * La descripción guardada debe ser siempre la línea íntegra del PDF.
 */
export function inferirCodigoProductoDesdeLinea(
  lineaCompleta: string,
  opts?: OpcionesInferirCodigo,
): string {
  const t = lineaCompleta.trim();
  /** Último token: alfanumérico (CAR-003, ABC123), o 1–10 dígitos al final (p. ej. …3KG 4). */
  const m = t.match(
    /^(.+?)\s+([A-Z]{1,6}-\d{2,8}|[A-Z]{2,10}-\d[A-Z0-9.\-/]{0,22}|[A-Z]{0,4}\d[A-Z0-9.\-/]{1,22}|\d{1,10})$/i,
  );
  if (!m) return "-";
  const desc = m[1]!.trim();
  const code = m[2]!;
  if (desc.length < 4) return "-";
  if (!codigoSoloDigitosValido(code, desc.length)) return "-";

  void opts;
  return code;
}

function construirItemDuxDesdeMatchImportes(
  descripcion: string,
  mCant: string,
  mPu: string,
  mPct: string,
  mSub: string,
  inferirOpts?: OpcionesInferirCodigo,
  /** Subtotal c/IVA (Factura A); si existe, reemplaza a mSub para el monto a cobrar. */
  mSubConIva?: string,
): ItemExtraido | null {
  const cant = parseNumeroArg(mCant);
  const precioUnit = parseNumeroArg(mPu);
  const subtotal = parseNumeroArg(mSubConIva ?? mSub);
  void mPct;
  if (!Number.isFinite(cant) || cant <= 0 || cant > 100_000) return null;
  if (!Number.isFinite(precioUnit) || precioUnit < 0) return null;

  const desc = descripcion.trim();
  if (desc.length < 3) return null;
  const codigo = codigoDesdeDescripcionRenglon(desc, inferirOpts);

  let pu = precioUnit;
  if (Number.isFinite(subtotal) && subtotal >= 0 && cant > 0) {
    const porSubt = subtotal / cant;
    if (Math.abs(porSubt - precioUnit) > 0.05 && Math.abs(porSubt - precioUnit) > 0.01 * precioUnit) {
      pu = Math.round(porSubt * 100) / 100;
    }
  }

  return { codigo, descripcion: desc, cantidad: cant, precioUnitario: pu };
}

/**
 * Una sola línea: «…descripción código 1,00 225.200,00 0,00 225.200,00».
 */
function parseItemDuxLineaUnica(
  lineRaw: string,
  inferirOpts?: OpcionesInferirCodigo,
): ItemExtraido | null {
  const line = lineRaw.trim();
  if (line.length < 15) return null;
  if (lineaPareceEncabezadoOlegal(line)) return null;

  const mEsp = line.match(RE_DUX_COLA_CON_ESPACIOS);
  if (mEsp && mEsp.index !== undefined && mEsp.index >= 1) {
    const descRaw = line.slice(0, mEsp.index).trim();
    if (!descRaw || lineaPareceEncabezadoOlegal(descRaw)) return null;
    if (/^[\d$.\s,]+$/.test(descRaw)) return null;
    return construirItemDuxDesdeMatchImportes(
      descRaw,
      mEsp[1]!,
      mEsp[2]!,
      mEsp[3]!,
      mEsp[4]!,
      inferirOpts,
    );
  }

  return null;
}

/**
 * Parser para comprobantes tipo Dux: la línea anterior a "1,0018.950,00..." es la descripción,
 * o la misma línea con espacios entre cantidad / P.U. / % / subtotal.
 */
export function extraerItemsFormatoDux(
  texto: string,
  inferirOpts?: OpcionesInferirCodigo,
): ItemExtraido[] {
  const lineas = texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  const items: ItemExtraido[] = [];
  const vistos = new Set<string>();

  function agregar(item: ItemExtraido): boolean {
    const clave = `${item.descripcion.toLowerCase()}|${item.cantidad}|${item.precioUnitario ?? 0}`;
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    items.push(item);
    return true;
  }

  for (let i = 1; i < lineas.length; i++) {
    const numLine = lineas[i]!;

    const m4 = numLine.match(RE_DUX_LINEA_IMPORTES);
    if (m4) {
      const descRaw = recolectarBloqueDescripcion(lineas, i);
      if (
        !descRaw ||
        lineaPareceEncabezadoOlegal(descRaw) ||
        RE_DUX_LINEA_IMPORTES.test(descRaw) ||
        /^[\d$.\s,]+$/.test(descRaw)
      ) {
        continue;
      }
      const peladoCheck = parsearImportesPelando(numLine);
      const subConIva =
        peladoCheck && peladoCheck.amounts.length === 5 ? peladoCheck.amounts[4] : undefined;
      const item = construirItemDuxDesdeMatchImportes(
        descRaw,
        m4[1]!,
        m4[2]!,
        m4[3]!,
        m4[4]!,
        inferirOpts,
        subConIva,
      );
      if (item) agregar(item);
      if (items.length >= 500) return items;
      continue;
    }

    const pelado = parsearImportesPelando(numLine);
    if (pelado && pelado.amounts.length === 5) {
      const descRaw = recolectarBloqueDescripcion(lineas, i);
      if (!descRaw || lineaPareceEncabezadoOlegal(descRaw)) continue;
      const [pu, pct, subNeto, , subIva] = pelado.amounts;
      const item = construirItemDuxDesdeMatchImportes(
        descRaw,
        pelado.cant,
        pu!,
        pct!,
        subNeto!,
        inferirOpts,
        subIva!,
      );
      if (item) agregar(item);
      if (items.length >= 500) return items;
    }
  }

  for (const line of lineas) {
    if (!line) continue;
    const item = parseItemDuxLineaUnica(line, inferirOpts);
    if (item) agregar(item);
    if (items.length >= 500) break;
  }

  return items;
}

function intentarLineaProducto(line: string, inferirOpts?: OpcionesInferirCodigo): ItemExtraido | null {
  const t = line.trim().replace(/\s+$/g, "");
  if (t.length < 8) return null;
  if (lineaPareceEncabezadoOlegal(t)) return null;
  if (RE_DUX_LINEA_IMPORTES.test(t)) return null;
  if (/^[\d.,\s%]+$/.test(t)) return null;
  if (/^total|^importe\s*total|^subtotal/i.test(t)) return null;

  const porTab = t.split(/\t/).map((p) => p.trim()).filter(Boolean);
  if (porTab.length >= 3) {
    const ultimo = porTab[porTab.length - 1];
    if (/^[\d.,]+$/.test(ultimo!)) {
      const cant = parseNumeroArg(ultimo!);
      if (Number.isFinite(cant) && cant > 0 && cant < 100_000) {
        let cuerpo = porTab.slice(0, -1);
        while (cuerpo.length && /^[\d.,]+$/.test(cuerpo[cuerpo.length - 1]!)) {
          cuerpo = cuerpo.slice(0, -1);
        }
        if (cuerpo.length === 0) return null;
        const primero = cuerpo[0]!;
        const codigoCol =
          /^[\w.\-/]{1,18}$/i.test(primero) && primero.length <= 16 ? primero : "";
        const codigo = codigoCol || codigoDesdeDescripcionRenglon(t, inferirOpts);
        if (t.length >= 3) {
          return { codigo: codigo || "-", descripcion: t, cantidad: cant };
        }
      }
    }
  }

  const porEspacios = t.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (porEspacios.length >= 2) {
    const ultimo = porEspacios[porEspacios.length - 1]!;
    if (/^[\d.,]+$/.test(ultimo)) {
      const cant = parseNumeroArg(ultimo);
      if (Number.isFinite(cant) && cant > 0 && cant < 50_000) {
        let resto = porEspacios.slice(0, -1);
        while (resto.length && /^[\d.,]+$/.test(resto[resto.length - 1]!)) {
          resto = resto.slice(0, -1);
        }
        if (resto.length === 0) return null;
        const primero = resto[0]!;
        const codigoCol =
          /^\d{1,12}$/.test(primero) || /^[A-Z0-9.\-/]{1,15}$/i.test(primero)
            ? primero
            : "";
        const codigo = codigoCol || codigoDesdeDescripcionRenglon(t, inferirOpts);
        if (t.length >= 3) {
          return { codigo: codigo || "-", descripcion: t, cantidad: cant };
        }
      }
    }
  }

  const mInicio = t.match(/^(\d+(?:[.,]\d+)?)\s+(.{4,200})$/);
  if (mInicio) {
    const cant = parseNumeroArg(mInicio[1]!);
    if (Number.isFinite(cant) && cant > 0 && cant < 100_000) {
      const codigo = codigoDesdeDescripcionRenglon(t, inferirOpts);
      return { codigo: codigo || "-", descripcion: t, cantidad: cant };
    }
  }

  return null;
}

export function extraerItemsDelTextoComprobante(
  texto: string,
  inferirOpts?: OpcionesInferirCodigo,
): ItemExtraido[] {
  const t = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const dux = extraerItemsFormatoDux(t, inferirOpts);
  if (dux.length > 0) return dux;

  const lineas = t.split("\n");
  const vistos = new Set<string>();
  const items: ItemExtraido[] = [];

  for (const linea of lineas) {
    const item = intentarLineaProducto(linea, inferirOpts);
    if (!item) continue;
    const clave = `${item.descripcion.toLowerCase()}|${item.cantidad}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    items.push(item);
    if (items.length >= 300) break;
  }

  return items;
}

/** Inicio de cada comprobante en el texto (varios PDF repiten el mismo layout). */
type InicioComprobanteEnTexto = {
  index: number;
  ptoVta: string;
  nro: string;
  /** Si el propio match ya trae la letra (p. ej. «X-00007-00003213»). */
  letraDelMatch: "A" | "B" | "C" | "X" | null;
};

/**
 * Recolecta posiciones de comprobante: «Nº 00007-00003213», «Nro 00007-00003213»,
 * «X-00007-00003213» / Factura A con mismo patrón, etc.
 */
function collectIniciosComprobante(t: string): InicioComprobanteEnTexto[] {
  const raw: InicioComprobanteEnTexto[] = [];

  for (const m of t.matchAll(/\bN(?:º|°|ro\.?)\s*(\d+)\s*[-–]\s*(\d+)/gi)) {
    if (m.index === undefined) continue;
    raw.push({
      index: m.index,
      ptoVta: m[1]!,
      nro: m[2]!,
      letraDelMatch: null,
    });
  }

  for (const m of t.matchAll(/\b([ABCX])\s*[-–]\s*(\d{1,5})\s*[-–]\s*(\d{4,12})\b/gi)) {
    if (m.index === undefined) continue;
    raw.push({
      index: m.index,
      ptoVta: m[2]!,
      nro: m[3]!,
      letraDelMatch: m[1]!.toUpperCase() as "A" | "B" | "C" | "X",
    });
  }

  raw.sort((a, b) => a.index - b.index);

  const dedup: InicioComprobanteEnTexto[] = [];
  for (const r of raw) {
    const prev = dedup[dedup.length - 1];
    if (
      prev &&
      prev.ptoVta === r.ptoVta &&
      prev.nro === r.nro &&
      r.index - prev.index < 48
    ) {
      if (r.letraDelMatch && !prev.letraDelMatch) dedup[dedup.length - 1] = r;
      continue;
    }
    dedup.push(r);
  }

  return dedup;
}

function parseFechaDdMmYyyyOrNull(
  dd: string | undefined,
  mm: string | undefined,
  yyyy: string | undefined,
): Date | null {
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(
    Number.parseInt(yyyy, 10),
    Number.parseInt(mm, 10) - 1,
    Number.parseInt(dd, 10),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function extraerLetraComprobanteOrNull(slice: string): "A" | "B" | "C" | "X" | null {
  const head = slice.slice(0, 1200);
  const mSolo = head.match(/\n\s*([ABCX])\s*\n/i);
  const mCercaNro = head.match(/\b([ABCX])\b\s*(?:N(?:º|°)|NRO\.?|NUM\.?)/i);
  const mFactura = head.match(/\bFACTURA\s+([ABCX])\b/i);
  const mComp = head.match(/\bCOMPROBANTE\s+([ABCX])\b/i);
  const mRemito = head.match(/\bREM(?:ITO)?\s+([ABCX])\b/i);
  const mLineaTipo = head.match(/\b(?:TIPO|COD\.?\s*DE\s*COMPROBANTE)\s*[:#]?\s*([ABCX])\b/i);
  const mInline = head.match(/\b([ABCX])\s*[-–]\s*\d{1,5}\s*[-–]\s*\d{4,12}/i);
  const l = (
    mInline?.[1] ??
    mFactura?.[1] ??
    mComp?.[1] ??
    mRemito?.[1] ??
    mLineaTipo?.[1] ??
    mSolo?.[1] ??
    mCercaNro?.[1] ??
    ""
  ).toUpperCase();
  return l === "A" || l === "B" || l === "C" || l === "X" ? l : null;
}

function extraerCaeOrNull(slice: string): string | null {
  const m = slice.match(/\bCAE:\s*(\d{14})\b/i);
  return m?.[1] ?? null;
}

function extraerCaeFechaVtoOrNull(slice: string): Date | null {
  const m =
    slice.match(/\bVTO\.?\s*CAE[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})\b/i) ??
    slice.match(/\bVENC(?:IMIENTO)?\.?\s*CAE[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{4})\b/i);
  if (!m) return null;
  return parseFechaDdMmYyyyOrNull(m[1], m[2], m[3]);
}

function extraerCuitClienteOrNull(slice: string): string | null {
  const cuits = [...slice.matchAll(/\bCUIT:\s*(\d{11})\b/gi)].map((m) => m[1]!);
  return cuits[1] ?? cuits[0] ?? null;
}

/** Varias facturas en un solo PDF (mismo formato, repetido). */
export function segmentarComprobantesDesdeTexto(texto: string): SegmentoComprobante[] {
  const t = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const inicios = collectIniciosComprobante(t);
  if (inicios.length === 0) {
    const letra = extraerLetraComprobanteOrNull(t);
    const cae = extraerCaeOrNull(t);
    const caeFechaVto = extraerCaeFechaVtoOrNull(t);
    const cuitCliente = extraerCuitClienteOrNull(t);
    const suger = extraerSugerenciaComprobante(t);
    const completoSuger = suger?.replace(/\s/g, "").replace(/–/g, "-") ?? "";
    return [
      {
        texto: t,
        comprobante: completoSuger,
        fecha: null,
        letra,
        comprobanteCompleto: completoSuger || (letra ? `${letra}-` : ""),
        cae,
        caeFechaVto,
        cuitCliente,
      },
    ];
  }

  return inicios.map((ini, i) => {
    const start = ini.index;
    const end = inicios[i + 1]?.index ?? t.length;
    const slice = t.slice(start, end);
    const letra = ini.letraDelMatch ?? extraerLetraComprobanteOrNull(slice);
    const comprobanteBase = `${ini.ptoVta}-${ini.nro}`;
    const comprobanteCompleto = letra ? `${letra}-${comprobanteBase}` : comprobanteBase;
    const fechaM = slice.match(/FECHA:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    let fecha: Date | null = null;
    if (fechaM) {
      fecha = new Date(
        Number.parseInt(fechaM[3]!, 10),
        Number.parseInt(fechaM[2]!, 10) - 1,
        Number.parseInt(fechaM[1]!, 10),
      );
      if (Number.isNaN(fecha.getTime())) fecha = null;
    }
    const cae = extraerCaeOrNull(slice);
    const caeFechaVto = extraerCaeFechaVtoOrNull(slice);
    const cuitCliente = extraerCuitClienteOrNull(slice);
    return {
      texto: slice,
      comprobante: comprobanteCompleto,
      fecha,
      letra,
      comprobanteCompleto,
      cae,
      caeFechaVto,
      cuitCliente,
    };
  });
}

export function contarComprobantesConNumero(texto: string): number {
  const t = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return collectIniciosComprobante(t).length;
}

export function extraerSugerenciaComprobante(texto: string): string | undefined {
  const t = texto.replace(/\s+/g, " ");
  const mTipoLetra = t.match(/\b([ABCX])\s*[-–]\s*(\d{1,5})\s*[-–]\s*(\d{4,12})\b/i);
  if (mTipoLetra) {
    const limpio = `${mTipoLetra[1]}-${mTipoLetra[2]}-${mTipoLetra[3]}`.replace(/–/g, "-").slice(0, 48);
    if (limpio.length >= 4) return limpio;
  }
  const patrones: RegExp[] = [
    /(?:n[°º]\s*|nro\.?\s*|comp\.?\s*|comprobante\s*)[:#]?\s*([A-Z]?\s*\d[\d\s\-/]{4,24})/i,
    /(?:cbte|comprobante)\s*(?:n[°º]|num)?\s*[:#]?\s*(\d{4,12})/i,
    /(?:punto\s*de\s*venta|pto\.?\s*vta\.?)\s*[:#]?\s*(\d{1,5})\s*[-–/]\s*(\d{4,10})/i,
    /N(?:º|°|ro\.?)\s*(\d+\s*[-–]\s*\d+)/i,
  ];
  for (const re of patrones) {
    const m = t.match(re);
    if (m) {
      const raw =
        m[2] !== undefined && /punto|vta|pto/i.test(re.source) ? `${m[1]}-${m[2]}` : m[1]!;
      const limpio = raw.replace(/\s+/g, "").replace(/–/g, "-").slice(0, 48);
      if (limpio && limpio.length >= 4) return limpio;
    }
  }
  return undefined;
}
