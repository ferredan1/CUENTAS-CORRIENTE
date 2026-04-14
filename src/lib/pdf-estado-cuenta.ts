import { etiquetaTipoMovimientoCliente } from "@/domain/movimientos/etiqueta-tipo";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import type { EstadoCuentaCargado } from "@/services/estado-cuenta-data";

function fmtCant(tipo: string, cantidad: number): string {
  if (tipo === "pago" || tipo === "devolucion") return "—";
  if (!Number.isFinite(cantidad)) return "—";
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(cantidad);
}

function trunc(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * PDF del estado de cuenta (A4 apaisado, tabla de movimientos).
 */
export function buildEstadoCuentaPdfBuffer(data: EstadoCuentaCargado): Promise<Buffer> {
  const incluirObra = !data.sinObra && !data.obraId;
  const periodoDesde = data.desde ? formatFechaCorta(data.desde) : "inicio";
  const periodoHasta = data.hasta ? formatFechaCorta(data.hasta) : "hoy";

  return new Promise((resolve, reject) => {
    void (async () => {
      const mod = await import("pdfkit");
      const PDFDocumentCtor = ((mod as unknown as { default?: unknown }).default ?? mod) as new (opts: {
      layout: "landscape";
      margin: number;
      size: "A4";
      info: { Title: string; Author: string };
      }) => {
        on: (event: string, cb: (chunk: Buffer) => void) => void;
        page: { width: number; height: number };
        y: number;
        addPage: (opts?: { layout?: string; size?: string; margin?: number }) => void;
        moveDown: (n?: number) => void;
        fontSize: (n: number) => any;
        font: (name: string) => any;
        fillColor: (color: string) => any;
        text: (text: string, x?: number, y?: number, opts?: Record<string, unknown>) => any;
        moveTo: (x: number, y: number) => any;
        lineTo: (x: number, y: number) => any;
        strokeColor: (color: string) => any;
        lineWidth: (n: number) => any;
        stroke: () => any;
        heightOfString: (text: string, opts?: Record<string, unknown>) => number;
        end: () => void;
        save: () => void;
        restore: () => void;
        opacity: (n: number) => void;
        rect: (x: number, y: number, w: number, h: number) => any;
      };

    const doc = new PDFDocumentCtor({
      layout: "landscape",
      margin: 36,
      size: "A4",
      info: {
        Title: `Estado de cuenta — ${data.cliente.nombre}`,
        Author: "Cuenta corriente",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 36;
    const right = doc.page.width - 36;
    const pageBottom = doc.page.height - 48;

    const col = {
      fecha: left,
      comp: left + 58,
      obra: left + 58 + 78,
      desc: left + 58 + 78 + (incluirObra ? 86 : 0),
      cant: right - 200,
      pUnit: right - 148,
      total: right - 78,
    };
    const descW = col.cant - col.desc - 8;

    function ensureSpace(minH: number) {
      if (doc.y + minH > pageBottom) {
        doc.addPage();
        drawHeaderRow(doc.y);
        doc.moveDown(0.5);
      }
    }

    function drawHeaderRow(y: number) {
      doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#0f172a");
      doc.text("Fecha", col.fecha, y, { width: 54 });
      doc.text("Comprobante", col.comp, y, { width: 74 });
      if (incluirObra) doc.text("Obra", col.obra, y, { width: 82 });
      doc.text("Descripción", col.desc, y, { width: Math.max(100, descW) });
      doc.text("Cant.", col.cant, y, { width: 40, align: "right" });
      doc.text("P. unit.", col.pUnit, y, { width: 62, align: "right" });
      doc.text("Total", col.total, y, { width: 70, align: "right" });
      doc.font("Helvetica").fillColor("#000000");
      const lineY = y + 11;
      doc.moveTo(left, lineY).lineTo(right, lineY).strokeColor("#cbd5e1").lineWidth(0.5).stroke();
      doc.y = lineY + 6;
    }

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#0f172a").text("Estado de cuenta", left, 36);
    doc.fontSize(10).font("Helvetica").fillColor("#000000");
    let yMeta = 54;
    doc.text(data.cliente.nombre, left, yMeta);
    yMeta += 14;
    if (data.cliente.cuit) {
      doc.fontSize(9).text(`CUIT: ${data.cliente.cuit}`, left, yMeta);
      yMeta += 12;
    }
    doc.fillColor("#475569").fontSize(8.5);
    doc.text(`Período: ${periodoDesde} al ${periodoHasta}`, left, yMeta);
    yMeta += 11;
    doc.text(`Alcance: ${data.etiquetaFiltroObra}`, left, yMeta);
    yMeta += 11;
    doc.fillColor("#000000").text(`Saldo anterior al período: ${formatMoneda(data.saldoAnterior)}`, left, yMeta);
    yMeta += 12;
    doc.fillColor("#64748b").text(`${data.movimientosConSaldo.length} movimiento(s)`, left, yMeta);
    doc.fillColor("#000000");
    doc.y = yMeta + 18;

    drawHeaderRow(doc.y);

    for (const m of data.movimientosConSaldo) {
      const descText = `[${etiquetaTipoMovimientoCliente(m)}] ${m.descripcion}`;
      const hDesc = doc.heightOfString(trunc(descText, 500), { width: Math.max(80, descW) });
      const rowH = Math.max(16, Math.min(hDesc + 4, 36));
      ensureSpace(rowH + 4);
      const yRow = doc.y;
      doc.fontSize(7).font("Helvetica");
      doc.text(formatFechaCorta(m.fecha), col.fecha, yRow, { width: 54 });
      doc.text(trunc(m.comprobante ?? "—", 24), col.comp, yRow, { width: 74 });
      if (incluirObra) doc.text(trunc(m.obra?.nombre ?? "—", 28), col.obra, yRow, { width: 82 });
      doc.text(trunc(descText, 500), col.desc, yRow, { width: Math.max(80, descW), lineGap: 1 });
      doc.text(fmtCant(m.tipo, Number(m.cantidad)), col.cant, yRow, { width: 40, align: "right" });
      const pUnit =
        m.tipo === "pago" || m.tipo === "devolucion" ? "—" : formatMoneda(Number(m.precioUnitario));
      doc.text(pUnit, col.pUnit, yRow, { width: 62, align: "right" });
      const sign = m.tipo === "pago" || m.tipo === "devolucion" ? "−" : "";
      doc.text(`${sign}${formatMoneda(Number(m.total))}`, col.total, yRow, { width: 70, align: "right" });
      doc.y = yRow + rowH;
    }

    if (data.movimientosConSaldo.length === 0) {
      ensureSpace(20);
      doc.fontSize(9).fillColor("#64748b").text("Sin movimientos para este período y filtros.", left, doc.y);
      doc.fillColor("#000000");
      doc.moveDown(0.75);
    }

    ensureSpace(52);
    doc.moveDown(0.35);
    doc.fontSize(9).font("Helvetica-Bold").text("Totales del período", left, doc.y);
    doc.font("Helvetica").fontSize(9).moveDown(0.2);
    doc.text(`Ventas / cargos: ${formatMoneda(data.totalVentasPeriodo)}`, left, doc.y);
    doc.moveDown(0.15);
    doc.text(`Pagos: −${formatMoneda(data.totalPagosSoloPeriodo)}`, left, doc.y);
    doc.moveDown(0.15);
    doc.text(`Devoluciones: −${formatMoneda(data.totalDevolucionesPeriodo)}`, left, doc.y);
    doc.moveDown(0.15);
    const saldoFinal =
      data.movimientosConSaldo.length > 0
        ? data.movimientosConSaldo[data.movimientosConSaldo.length - 1]!.saldo
        : data.saldoAnterior;
    doc.text(`Saldo al cierre del listado: ${formatMoneda(saldoFinal)}`, left, doc.y);

    if (data.resumenSaldosPorObra.length > 0 && incluirObra) {
      doc.addPage({ layout: "portrait", size: "A4" });
      const pad = 36;
      const fullW = doc.page.width - 2 * pad;
      let yDash = pad;
      doc.save();
      doc.rect(pad, yDash, fullW, 30).fill("#2563eb");
      doc
        .fillColor("#ffffff")
        .fontSize(13)
        .font("Helvetica-Bold")
        .text("ESTADO DE CUENTAS", pad, yDash + 9, { width: fullW, align: "center" });
      yDash += 30;
      for (const row of data.resumenSaldosPorObra) {
        const rowH = 24;
        doc.rect(pad, yDash, fullW, rowH).fill("#2563eb");
        doc.moveTo(pad + fullW * 0.62, yDash)
          .lineTo(pad + fullW * 0.62, yDash + rowH)
          .opacity(0.35)
          .strokeColor("#ffffff")
          .lineWidth(0.5)
          .stroke()
          .opacity(1);
        doc.fillColor("#ffffff")
          .font("Helvetica")
          .fontSize(9)
          .text(`${row.orden}. ${row.nombre.toUpperCase()}`, pad + 10, yDash + 7, {
            width: fullW * 0.58,
          });
        doc.font("Helvetica-Bold").text(formatMoneda(row.saldo), pad + fullW * 0.64, yDash + 7, {
          width: fullW * 0.34 - 10,
          align: "right",
        });
        yDash += rowH;
      }
      const totalResumenObras = data.resumenSaldosPorObra.reduce((s, r) => s + r.saldo, 0);
      const rowHTotal = 26;
      doc.moveTo(pad, yDash)
        .lineTo(pad + fullW, yDash)
        .strokeColor("#ffffff")
        .lineWidth(1)
        .opacity(0.45)
        .stroke()
        .opacity(1);
      doc.rect(pad, yDash, fullW, rowHTotal).fill("#1e40af");
      doc.moveTo(pad + fullW * 0.62, yDash)
        .lineTo(pad + fullW * 0.62, yDash + rowHTotal)
        .opacity(0.35)
        .strokeColor("#ffffff")
        .lineWidth(0.5)
        .stroke()
        .opacity(1);
      doc.fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("TOTAL", pad + 10, yDash + 8, { width: fullW * 0.58 });
      doc.text(formatMoneda(totalResumenObras), pad + fullW * 0.64, yDash + 8, {
        width: fullW * 0.34 - 10,
        align: "right",
      });
      doc.restore();
    }

    doc.end();
    })().catch(reject);
  });
}
