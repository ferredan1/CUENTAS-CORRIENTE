import { normalizarComprobanteParaDuplicado } from "@/domain/comprobantes/normalize";
import {
  assertPagoChequeCompleto,
  calcularTotalMovimiento,
} from "@/domain/movimientos/rules";
import { toDecimal2 } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import { esMedioPago } from "@/types/domain";
import { Prisma, type MedioPago } from "@prisma/client";

const MEDIO_CHEQUE = "cheque" as const;

type Tx = Prisma.TransactionClient;

function parseMedioPago(raw: string | null | undefined): MedioPago | null {
  if (raw == null || String(raw).trim() === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (!esMedioPago(v)) throw new Error("Medio de pago inválido");
  return v;
}

function sumImportesAplicados(
  rows: { importeAplicado: Prisma.Decimal | { toString(): string } }[],
): Prisma.Decimal {
  return rows.reduce(
    (s, r) => s.add(new Prisma.Decimal(r.importeAplicado.toString())),
    new Prisma.Decimal(0),
  );
}

/** Expuesto para tests: la suma de aplicaciones (previas + nuevas) no puede superar el total del pago. */
export function assertSumaAplicacionesNoExcedeTotalPago(
  sumaYaAplicada: Prisma.Decimal,
  sumaNuevaBatch: Prisma.Decimal,
  importeTotalPago: Prisma.Decimal,
): void {
  if (sumaYaAplicada.add(sumaNuevaBatch).gt(importeTotalPago)) {
    throw new Error("La suma de aplicaciones supera el importe total del pago");
  }
}

/** Expuesto para tests: cada línea no puede aplicar más que el saldo pendiente de la venta. */
export function assertImporteAplicadoNoExcedeSaldoVenta(
  importeAplicado: Prisma.Decimal,
  saldoPendienteVenta: Prisma.Decimal,
  etiquetaComprobante?: string | null,
): void {
  if (importeAplicado.gt(saldoPendienteVenta)) {
    const suf = etiquetaComprobante ? ` (${etiquetaComprobante})` : "";
    throw new Error(`El importe supera el saldo pendiente (${saldoPendienteVenta.toFixed(2)}) de la venta${suf}`);
  }
}

export type CrearPagoInput = {
  clienteId: string;
  obraId?: string | null;
  fecha: Date;
  importeTotal: number;
  medioPago?: string | null;
  comprobante?: string | null;
  observaciones?: string | null;
  descripcion?: string | null;
  chequeNumero?: string | null;
  chequeBanco?: string | null;
  chequeVencimiento?: Date | null;
  fechaRecepcion?: Date | null;
  aplicaciones?: { movimientoId: string; importeAplicado: number }[];
};

async function crearMovimientoPagoEnTx(
  tx: Tx,
  input: {
    clienteId: string;
    obraId: string | null;
    fecha: Date;
    importeTotal: number;
    medioPago: MedioPago | null;
    comprobante: string | null;
    descripcion: string;
    chequeNumero: string | null;
    chequeBanco: string | null;
    chequeVencimiento: Date | null;
    fechaRecepcion: Date | null;
  },
) {
  const c = await tx.cliente.findFirst({
    where: { id: input.clienteId },
    select: { id: true },
  });
  if (!c) throw new Error("Cliente no encontrado");

  if (input.obraId) {
    const o = await tx.obra.findFirst({
      where: { id: input.obraId, clienteId: input.clienteId },
      select: { id: true, clienteId: true },
    });
    if (!o || o.clienteId !== input.clienteId) throw new Error("Obra no válida para el cliente");
  }

  const cantidad = 1;
  const precioUnitario = input.importeTotal;
  const total = calcularTotalMovimiento(cantidad, precioUnitario);
  const compTrim = input.comprobante;
  const normKey = compTrim ? normalizarComprobanteParaDuplicado(compTrim) : "";
  const normalizedComprobante = normKey.length >= 2 ? normKey : null;

  return tx.movimiento.create({
    data: {
      clienteId: input.clienteId,
      obraId: input.obraId,
      archivoId: null,
      tipo: "pago",
      fecha: input.fecha,
      comprobante: compTrim,
      normalizedComprobante,
      codigoProducto: null,
      descripcion: input.descripcion.trim(),
      cantidad,
      precioUnitario: toDecimal2(precioUnitario),
      total: toDecimal2(total),
      saldoPendiente: toDecimal2(0),
      medioPago: input.medioPago,
      chequeNumero: input.chequeNumero,
      chequeBanco: input.medioPago === MEDIO_CHEQUE ? input.chequeBanco : null,
      chequeVencimiento: input.chequeVencimiento,
      fechaRecepcion: input.fechaRecepcion,
    },
  });
}

type PagoConAplicaciones = Prisma.PagoGetPayload<{ include: { aplicaciones: true } }>;

/**
 * Ejecuta imputaciones sobre ventas. Debe llamarse dentro de una transacción.
 */
async function ejecutarAplicacionesSobrePago(
  tx: Tx,
  pago: PagoConAplicaciones & { importeTotal: Prisma.Decimal },
  aplicaciones: { movimientoId: string; importeAplicado: number }[],
) {
  if (aplicaciones.length === 0) return;

  const yaAplicado = sumImportesAplicados(pago.aplicaciones);
  const nuevoBatch = aplicaciones.reduce(
    (s, a) => s.add(new Prisma.Decimal(String(a.importeAplicado))),
    new Prisma.Decimal(0),
  );
  const limite = new Prisma.Decimal(pago.importeTotal.toString());
  assertSumaAplicacionesNoExcedeTotalPago(yaAplicado, nuevoBatch, limite);

  const movPagoId = pago.movimientoPagoId;

  for (const ap of aplicaciones) {
    if (!(ap.importeAplicado > 0) || !Number.isFinite(ap.importeAplicado)) {
      throw new Error("Importe aplicado inválido");
    }
    const importeDec = toDecimal2(ap.importeAplicado);

    const mov = await tx.movimiento.findFirst({
      where: {
        id: ap.movimientoId,
        clienteId: pago.clienteId,
        tipo: "venta",
      },
    });
    if (!mov) throw new Error(`Venta no encontrada o no pertenece al cliente: ${ap.movimientoId}`);

    const pendiente = new Prisma.Decimal(mov.saldoPendiente.toString());
    assertImporteAplicadoNoExcedeSaldoVenta(importeDec, pendiente, mov.comprobante ?? mov.id);

    await tx.aplicacionPago.create({
      data: {
        pagoId: pago.id,
        movimientoId: ap.movimientoId,
        importeAplicado: importeDec,
      },
    });

    const rest = pendiente.minus(importeDec);
    const cerrada = rest.lte(new Prisma.Decimal(0));

    await tx.movimiento.update({
      where: { id: ap.movimientoId },
      data: {
        saldoPendiente: cerrada ? toDecimal2(0) : toDecimal2(Number(rest.toFixed(2))),
        liquidadoAt: cerrada ? new Date() : null,
        liquidadoPorPagoId: cerrada && movPagoId ? movPagoId : null,
      },
    });
  }
}

export async function aplicarPagoAMovimientos(
  pagoId: string,
  aplicaciones: { movimientoId: string; importeAplicado: number }[],
) {
  if (aplicaciones.length === 0) return { ok: true as const };

  return prisma.$transaction(async (tx) => {
    const pago = await tx.pago.findFirst({
      where: { id: pagoId },
      include: { aplicaciones: true },
    });
    if (!pago) throw new Error("Pago no encontrado");

    await ejecutarAplicacionesSobrePago(tx, pago, aplicaciones);
    return { ok: true as const };
  });
}

export async function crearPago(input: CrearPagoInput) {
  const importeTotal = Number(input.importeTotal);
  if (!Number.isFinite(importeTotal) || importeTotal <= 0) {
    throw new Error("importeTotal inválido");
  }

  const c = await prisma.cliente.findFirst({
    where: { id: input.clienteId },
    select: { id: true },
  });
  if (!c) throw new Error("Cliente no encontrado");

  let obraId: string | null = input.obraId?.trim() || null;
  if (obraId) {
    const o = await prisma.obra.findFirst({
      where: { id: obraId, clienteId: input.clienteId },
      select: { id: true, clienteId: true },
    });
    if (!o || o.clienteId !== input.clienteId) throw new Error("Obra no válida para el cliente");
  }

  const medioParsed = parseMedioPago(input.medioPago);
  const chNum = input.chequeNumero?.trim() || null;
  const chBanco = input.chequeBanco?.trim() || null;
  const chVto = input.chequeVencimiento ?? null;
  const chRec = input.fechaRecepcion ?? null;

  assertPagoChequeCompleto("pago", medioParsed ? String(medioParsed) : null, chNum, chBanco, chVto, chRec);

  const descripcion =
    (input.descripcion?.trim() ||
      (input.comprobante?.trim() ? `Pago comprobante ${input.comprobante.trim()}` : "Pago")) ??
    "Pago";

  return prisma.$transaction(async (tx) => {
    const movPago = await crearMovimientoPagoEnTx(tx, {
      clienteId: input.clienteId,
      obraId,
      fecha: input.fecha,
      importeTotal,
      medioPago: medioParsed,
      comprobante: input.comprobante?.trim() || null,
      descripcion,
      chequeNumero: chNum,
      chequeBanco: chBanco,
      chequeVencimiento: chVto,
      fechaRecepcion: chRec,
    });

    const pago = await tx.pago.create({
      data: {
        clienteId: input.clienteId,
        fecha: input.fecha,
        importeTotal: toDecimal2(importeTotal),
        medioPago: medioParsed,
        comprobante: input.comprobante?.trim() || null,
        observaciones: input.observaciones?.trim() || null,
        movimientoPagoId: movPago.id,
      },
      include: { aplicaciones: true },
    });

    if (input.aplicaciones?.length) {
      await ejecutarAplicacionesSobrePago(tx, pago, input.aplicaciones);
    }

    return tx.pago.findFirstOrThrow({
      where: { id: pago.id },
      include: { aplicaciones: { include: { movimiento: true } }, movimientoPago: true },
    });
  });
}

export async function getSaldoPendienteMovimiento(movimientoId: string) {
  const mov = await prisma.movimiento.findFirst({
    where: { id: movimientoId, tipo: "venta" },
    select: { saldoPendiente: true },
  });
  if (!mov) return null;
  return Number(mov.saldoPendiente);
}

export async function getPagoConAplicaciones(pagoId: string) {
  return prisma.pago.findFirst({
    where: { id: pagoId },
    include: {
      aplicaciones: { include: { movimiento: true } },
      movimientoPago: true,
      cliente: { select: { id: true, nombre: true } },
    },
  });
}
