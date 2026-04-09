import { formatFechaCorta, formatMoneda } from "@/lib/format";

export type MovimientoParaWhatsapp = {
  fecha: Date;
  tipo: string;
  comprobante: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  saldo: number;
  obraNombre: string | null;
};

function fmtCantWhatsapp(tipo: string, cantidad: number): string {
  if (tipo === "pago" || tipo === "devolucion") return "—";
  if (!Number.isFinite(cantidad)) return "—";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(cantidad);
}

function trunc(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/**
 * Texto plano para WhatsApp con detalle de movimientos y totales (se acorta si supera maxChars).
 */
export function armarMensajeEstadoCuentaWhatsapp(opts: {
  nombreCliente: string;
  desde: Date | null;
  hasta: Date | null;
  etiquetaFiltroObra: string;
  saldoAnterior: number;
  movimientos: MovimientoParaWhatsapp[];
  totalVentas: number;
  totalPagos: number;
  incluirObraEnLineas: boolean;
  maxChars?: number;
}): string {
  const maxChars = opts.maxChars ?? 3800;
  const periodoDesde = opts.desde ? formatFechaCorta(opts.desde) : "inicio";
  const periodoHasta = opts.hasta ? formatFechaCorta(opts.hasta) : "hoy";
  const saldoFinal =
    opts.movimientos.length > 0
      ? opts.movimientos[opts.movimientos.length - 1]!.saldo
      : opts.saldoAnterior;

  const header = [
    `*Estado de cuenta — ${opts.nombreCliente.trim() || "Cliente"}*`,
    `Período: ${periodoDesde} al ${periodoHasta}`,
    `Alcance: ${opts.etiquetaFiltroObra}`,
    `Saldo anterior al período: ${formatMoneda(opts.saldoAnterior)}`,
    "",
    "*Detalle de movimientos:*",
  ].join("\n");

  const footer = [
    "",
    "*Totales del período*",
    `Ventas / cargos: ${formatMoneda(opts.totalVentas)}`,
    `Pagos / devoluciones: −${formatMoneda(opts.totalPagos)}`,
    `Saldo al cierre del listado: ${formatMoneda(saldoFinal)}`,
  ].join("\n");

  let body = "";
  let used = 0;
  const maxBody = Math.max(400, maxChars - header.length - footer.length - 120);
  let omitidos = 0;

  for (let i = 0; i < opts.movimientos.length; i++) {
    const m = opts.movimientos[i]!;
    const obraSuf = opts.incluirObraEnLineas && m.obraNombre ? ` · ${trunc(m.obraNombre, 28)}` : "";
    const pUnit =
      m.tipo === "pago" || m.tipo === "devolucion" ? "—" : formatMoneda(Number(m.precioUnitario));
    const sign = m.tipo === "pago" || m.tipo === "devolucion" ? "−" : "";
    const line = [
      `${i + 1}) ${formatFechaCorta(m.fecha)} · ${m.tipo}`,
      `   Comp: ${m.comprobante?.trim() || "—"}`,
      `   ${trunc(m.descripcion, 200)}`,
      `   Cant: ${fmtCantWhatsapp(m.tipo, Number(m.cantidad))} · P.unit: ${pUnit} · Total: ${sign}${formatMoneda(Number(m.total))} · Saldo corr.: ${formatMoneda(m.saldo)}${obraSuf}`,
    ].join("\n");

    if (used + line.length + 1 > maxBody) {
      omitidos = opts.movimientos.length - i;
      break;
    }
    body += (body ? "\n\n" : "") + line;
    used += line.length + 2;
  }

  if (omitidos > 0) {
    body += `\n\n_… ${omitidos} movimiento(s) no incluidos por límite de mensaje. Completá desde el estado de cuenta en la app._`;
  }

  if (!body.trim()) {
    body = "_Sin movimientos en este período y filtros._";
  }

  return `${header}\n\n${body}${footer}`;
}
