import {
  anexarMarcadorNoAnticipoCartera,
  notasIndicanExcluirAnticipoCartera,
} from "@/domain/cartera-no-anticipo-notas";
import { normalizarComprobanteParaDuplicado } from "@/domain/comprobantes/normalize";
import {
  assertPagoChequeCompleto,
  assertPatchPermitidoVentaImportada,
  assertVentaTieneArchivo,
  calcularTotalMovimiento,
} from "@/domain/movimientos/rules";
import { toDecimal2 } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import { archivoDelCliente } from "@/services/archivos";
import { auditLogCambio } from "@/services/audit";
import { esMedioPago, esTipoMovimiento } from "@/types/domain";
import type { MedioPago, Prisma, TipoMovimiento } from "@prisma/client";

const MEDIO_CHEQUE = "cheque" as const;

async function clienteExiste(clienteId: string) {
  return prisma.cliente.findFirst({
    where: { id: clienteId },
    select: { id: true },
  });
}

async function obraDelCliente(obraId: string, clienteId: string) {
  return prisma.obra.findFirst({
    where: { id: obraId, clienteId },
    select: { id: true, clienteId: true },
  });
}

function parseMedioPago(raw: string | null | undefined): MedioPago | null {
  if (raw == null || String(raw).trim() === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (!esMedioPago(v)) throw new Error("Medio de pago inválido");
  return v;
}

export type CrearMovimientoInput = {
  clienteId: string;
  obraId?: string | null;
  tipo: string;
  fecha: Date;
  notas?: string | null;
  comprobante?: string | null;
  codigoProducto?: string | null;
  medioPago?: string | null;
  chequeNumero?: string | null;
  chequeBanco?: string | null;
  chequeVencimiento?: Date | null;
  fechaRecepcion?: Date | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  archivoId?: string | null;
  /** Si se indica, solo se liquidan estas ventas (no el bloque amplio por comprobante). */
  liquidarVentaIds?: string[];
};

export async function crearMovimiento(input: CrearMovimientoInput) {
  if (!esTipoMovimiento(input.tipo)) {
    throw new Error("Tipo de movimiento inválido");
  }
  const tipo = input.tipo as TipoMovimiento;

  const c = await clienteExiste(input.clienteId);
  if (!c) throw new Error("Cliente no encontrado");

  if (input.obraId) {
    const o = await obraDelCliente(input.obraId, input.clienteId);
    if (!o || o.clienteId !== input.clienteId) {
      throw new Error("Obra no válida para el cliente");
    }
  }

  let archivoId: string | null = null;
  if (tipo === "venta") {
    assertVentaTieneArchivo(input.archivoId);
    const aid = input.archivoId!.trim();
    const arch = await archivoDelCliente(aid, input.clienteId);
    if (!arch) {
      throw new Error("El comprobante PDF no pertenece a este cliente o no existe.");
    }
    archivoId = aid;
  }

  const cantidad = Number(input.cantidad);
  const precioUnitario = Number(input.precioUnitario);
  const total = calcularTotalMovimiento(cantidad, precioUnitario);

  const medioParsed = tipo === "pago" ? parseMedioPago(input.medioPago) : null;
  const chNum = input.chequeNumero?.trim() || null;
  const chBanco = input.chequeBanco?.trim() || null;
  const chVto = input.chequeVencimiento ?? null;
  const chRec = input.fechaRecepcion ?? null;

  assertPagoChequeCompleto(
    tipo,
    medioParsed ? String(medioParsed) : null,
    chNum,
    chBanco,
    chVto,
    chRec,
  );

  const datosCheque =
    tipo === "pago"
      ? {
          medioPago: medioParsed,
          chequeNumero: chNum,
          chequeBanco: medioParsed === MEDIO_CHEQUE ? chBanco : null,
          chequeVencimiento: chVto,
          fechaRecepcion: chRec,
        }
      : {};

  const compTrim = input.comprobante?.trim() ?? null;
  const normKey =
    tipo === "venta" && compTrim
      ? normalizarComprobanteParaDuplicado(compTrim)
      : "";
  const normalizedComprobante = normKey.length >= 2 ? normKey : null;

  const saldoInicialVenta = tipo === "venta" ? toDecimal2(total) : toDecimal2(0);

  const created = await prisma.movimiento.create({
    data: {
      clienteId: input.clienteId,
      obraId: input.obraId ?? null,
      archivoId,
      tipo,
      fecha: input.fecha,
      ...(input.notas !== undefined
        ? { notas: input.notas?.trim() ? input.notas.trim() : null }
        : {}),
      comprobante: compTrim,
      normalizedComprobante,
      codigoProducto: input.codigoProducto ?? null,
      descripcion: input.descripcion.trim(),
      cantidad,
      precioUnitario: toDecimal2(precioUnitario),
      total: toDecimal2(total),
      saldoPendiente: saldoInicialVenta,
      ...datosCheque,
    },
  });

  const liquidarIds = input.liquidarVentaIds?.filter((x) => x?.trim()) ?? [];
  if (tipo === "pago" && liquidarIds.length > 0) {
    const valid = await prisma.movimiento.findMany({
      where: {
        id: { in: liquidarIds },
        clienteId: input.clienteId,
        tipo: "venta",
        liquidadoAt: null,
      },
      select: { id: true },
    });
    if (valid.length !== liquidarIds.length) {
      throw new Error("Alguna venta no existe, ya fue liquidada o no pertenece al cliente.");
    }
    await prisma.movimiento
      .updateMany({
        where: { id: { in: valid.map((v) => v.id) } },
        data: {
          saldoPendiente: toDecimal2(0),
          liquidadoAt: new Date(),
          liquidadoPorPagoId: created.id,
        },
      })
      .catch((e) => {
        console.error("[liquidacion] No se pudo marcar ventas como liquidadas:", e);
      });
  } else if (tipo === "pago" && compTrim) {
    // Solo ventas ligadas a PDF (archivoId no nulo); no liquidar ventas manuales sin comprobante archivo.
    const norm = normalizarComprobanteParaDuplicado(compTrim);
    const key = norm.length >= 2 ? norm : compTrim.replace(/\s+/g, "").toLowerCase();
    await prisma.movimiento
      .updateMany({
        where: {
          clienteId: input.clienteId,
          tipo: "venta",
          liquidadoAt: null,
          archivoId: { not: null },
          OR: [{ normalizedComprobante: key }, { comprobante: compTrim }],
        },
        data: {
          saldoPendiente: toDecimal2(0),
          liquidadoAt: new Date(),
          liquidadoPorPagoId: created.id,
        },
      })
      .catch((e) => {
        console.error("[liquidacion] No se pudo marcar ventas como liquidadas:", e);
      });
  }

  return created;
}

export type ListarMovimientosFiltro = {
  clienteId?: string;
  obraId?: string;
  sinObra?: boolean;
  desde?: Date;
  hasta?: Date;
  tipo?: string;
  /** Límite de filas (default 500, máx. 2000). */
  limit?: number;
};

export async function listarMovimientos(f: ListarMovimientosFiltro) {
  const where: Prisma.MovimientoWhereInput = {};

  if (f.clienteId) where.clienteId = f.clienteId;
  if (f.sinObra) {
    where.obraId = null;
  } else if (f.obraId !== undefined && f.obraId !== "") {
    where.obraId = f.obraId;
  }

  if (f.tipo !== undefined && f.tipo !== "" && esTipoMovimiento(f.tipo)) {
    where.tipo = f.tipo as TipoMovimiento;
  }

  if (f.desde || f.hasta) {
    where.fecha = {};
    if (f.desde) where.fecha.gte = f.desde;
    if (f.hasta) where.fecha.lte = f.hasta;
  }

  const raw = f.limit ?? 2000;
  const take = Math.min(Math.max(Number(raw) || 2000, 1), 5000);

  return prisma.movimiento.findMany({
    where,
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    take,
    include: { obra: { select: { id: true, nombre: true } } },
  });
}

export async function actualizarMovimiento(
  movimientoId: string,
  patch: Partial<{
    fecha: Date;
    notas: string | null;
    comprobante: string | null;
    codigoProducto: string | null;
    medioPago: string | null;
    estadoCheque: string | null;
    chequeNumero: string | null;
    chequeBanco: string | null;
    chequeVencimiento: Date | null;
    fechaRecepcion: Date | null;
    liquidadoAt: Date | null;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    tipo: string;
    obraId: string | null;
  }>,
) {
  const existente = await prisma.movimiento.findFirst({
    where: { id: movimientoId },
  });
  if (!existente) return null;

  if (patch.tipo !== undefined && !esTipoMovimiento(patch.tipo)) {
    throw new Error("Tipo de movimiento inválido");
  }
  const tipoPatch = patch.tipo !== undefined ? (patch.tipo as TipoMovimiento) : undefined;

  if (tipoPatch === "venta") {
    throw new Error(
      "No se puede convertir un movimiento en «venta» desde la grilla; las ventas solo se cargan desde el PDF del comprobante.",
    );
  }

  assertPatchPermitidoVentaImportada(existente, {
    comprobante: patch.comprobante,
    cantidad: patch.cantidad,
    precioUnitario: patch.precioUnitario,
    tipo: tipoPatch,
  });

  let obraId = patch.obraId !== undefined ? patch.obraId : existente.obraId;
  if (patch.obraId !== undefined && patch.obraId) {
    const o = await obraDelCliente(patch.obraId, existente.clienteId);
    if (!o || o.clienteId !== existente.clienteId) {
      throw new Error("Obra no válida");
    }
    obraId = patch.obraId;
  } else if (patch.obraId === null) {
    obraId = null;
  }

  const cantidad = patch.cantidad !== undefined ? Number(patch.cantidad) : existente.cantidad;
  const precioUnitario =
    patch.precioUnitario !== undefined
      ? Number(patch.precioUnitario)
      : Number(existente.precioUnitario);

  const total = calcularTotalMovimiento(cantidad, precioUnitario);

  const tipoFinal = tipoPatch ?? existente.tipo;
  let medioParsed: MedioPago | null | undefined;
  if (patch.medioPago !== undefined) {
    medioParsed =
      patch.medioPago === null || String(patch.medioPago).trim() === ""
        ? null
        : parseMedioPago(patch.medioPago);
  }

  const medioFinal =
    medioParsed !== undefined ? medioParsed : (existente.medioPago as MedioPago | null);
  const chNum =
    patch.chequeNumero !== undefined
      ? patch.chequeNumero === null || String(patch.chequeNumero).trim() === ""
        ? null
        : String(patch.chequeNumero).trim()
      : existente.chequeNumero;
  const chBanco =
    patch.chequeBanco !== undefined
      ? patch.chequeBanco === null || String(patch.chequeBanco).trim() === ""
        ? null
        : String(patch.chequeBanco).trim()
      : existente.chequeBanco;
  const chVto =
    patch.chequeVencimiento !== undefined ? patch.chequeVencimiento : existente.chequeVencimiento;
  const chRec =
    patch.fechaRecepcion !== undefined ? patch.fechaRecepcion : existente.fechaRecepcion;

  assertPagoChequeCompleto(
    String(tipoFinal),
    medioFinal ? String(medioFinal) : null,
    chNum,
    chBanco,
    chVto,
    chRec,
  );

  const comprobanteNext =
    patch.comprobante !== undefined ? patch.comprobante : existente.comprobante;
  const compStr = comprobanteNext?.trim() ?? null;
  let normalizedNext: string | null = existente.normalizedComprobante;
  if (patch.comprobante !== undefined) {
    const k = compStr ? normalizarComprobanteParaDuplicado(compStr) : "";
    normalizedNext = k.length >= 2 ? k : null;
  }

  const fechaFinal = patch.fecha ?? existente.fecha;
  const tipoFinal2 = (patch.tipo !== undefined ? tipoPatch! : existente.tipo) as TipoMovimiento;
  const descripcionFinal = patch.descripcion !== undefined ? patch.descripcion.trim() : existente.descripcion;
  const liquidadoAtFinal = patch.liquidadoAt !== undefined ? patch.liquidadoAt : existente.liquidadoAt;

  const reopeningVenta =
    tipoFinal2 === "venta" && existente.liquidadoAt != null && liquidadoAtFinal == null;
  const medioPagoFinal =
    patch.medioPago !== undefined ? (medioParsed ?? null) : (existente.medioPago as MedioPago | null);
  const estadoChequeFinal =
    patch.estadoCheque !== undefined
      ? patch.estadoCheque
      : ((existente as { estadoCheque?: string | null }).estadoCheque ?? null);

  let notasFinal: string | null =
    patch.notas === undefined
      ? (existente.notas ?? null)
      : patch.notas === null || typeof patch.notas !== "string" || patch.notas.trim() === ""
        ? null
        : patch.notas.trim();

  if (
    tipoFinal2 === "pago" &&
    notasIndicanExcluirAnticipoCartera(existente.notas) &&
    !notasIndicanExcluirAnticipoCartera(notasFinal)
  ) {
    notasFinal = anexarMarcadorNoAnticipoCartera(notasFinal);
  }

  const codigoProductoFinal =
    patch.codigoProducto === undefined
      ? (existente.codigoProducto ?? null)
      : patch.codigoProducto === null || String(patch.codigoProducto).trim() === ""
        ? null
        : String(patch.codigoProducto).trim();

  const chequeNumeroFinal =
    patch.chequeNumero === undefined
      ? (existente.chequeNumero ?? null)
      : patch.chequeNumero === null || String(patch.chequeNumero).trim() === ""
        ? null
        : String(patch.chequeNumero).trim();

  const chequeBancoFinal =
    patch.chequeBanco === undefined
      ? (existente.chequeBanco ?? null)
      : patch.chequeBanco === null || String(patch.chequeBanco).trim() === ""
        ? null
        : String(patch.chequeBanco).trim();

  const chequeVencimientoFinal =
    patch.chequeVencimiento !== undefined ? patch.chequeVencimiento : existente.chequeVencimiento;
  const fechaRecepcionFinal = patch.fechaRecepcion !== undefined ? patch.fechaRecepcion : existente.fechaRecepcion;

  const cambios: Array<{ campo: string; valorAntes: unknown; valorDespues: unknown }> = [];
  if (fechaFinal.getTime() !== existente.fecha.getTime()) {
    cambios.push({ campo: "fecha", valorAntes: existente.fecha, valorDespues: fechaFinal });
  }
  if ((existente.notas ?? null) !== (notasFinal ?? null)) {
    cambios.push({ campo: "notas", valorAntes: existente.notas ?? null, valorDespues: notasFinal ?? null });
  }
  if ((existente.comprobante ?? null) !== (compStr ?? null)) {
    cambios.push({ campo: "comprobante", valorAntes: existente.comprobante ?? null, valorDespues: compStr ?? null });
  }
  if ((existente.codigoProducto ?? null) !== (codigoProductoFinal ?? null)) {
    cambios.push({
      campo: "codigoProducto",
      valorAntes: existente.codigoProducto ?? null,
      valorDespues: codigoProductoFinal ?? null,
    });
  }
  if ((existente.medioPago ?? null) !== (medioPagoFinal ?? null)) {
    cambios.push({ campo: "medioPago", valorAntes: existente.medioPago ?? null, valorDespues: medioPagoFinal ?? null });
  }
  if (((existente as { estadoCheque?: string | null }).estadoCheque ?? null) !== (estadoChequeFinal ?? null)) {
    cambios.push({
      campo: "estadoCheque",
      valorAntes: ((existente as { estadoCheque?: string | null }).estadoCheque ?? null) as unknown,
      valorDespues: estadoChequeFinal ?? null,
    });
  }
  if ((existente.chequeNumero ?? null) !== (chequeNumeroFinal ?? null)) {
    cambios.push({
      campo: "chequeNumero",
      valorAntes: existente.chequeNumero ?? null,
      valorDespues: chequeNumeroFinal ?? null,
    });
  }
  if ((existente.chequeBanco ?? null) !== (chequeBancoFinal ?? null)) {
    cambios.push({
      campo: "chequeBanco",
      valorAntes: existente.chequeBanco ?? null,
      valorDespues: chequeBancoFinal ?? null,
    });
  }
  if ((existente.chequeVencimiento ?? null)?.getTime?.() !== (chequeVencimientoFinal ?? null)?.getTime?.()) {
    cambios.push({
      campo: "chequeVencimiento",
      valorAntes: existente.chequeVencimiento ?? null,
      valorDespues: chequeVencimientoFinal ?? null,
    });
  }
  if ((existente.fechaRecepcion ?? null)?.getTime?.() !== (fechaRecepcionFinal ?? null)?.getTime?.()) {
    cambios.push({
      campo: "fechaRecepcion",
      valorAntes: existente.fechaRecepcion ?? null,
      valorDespues: fechaRecepcionFinal ?? null,
    });
  }
  if ((existente.liquidadoAt ?? null)?.getTime?.() !== (liquidadoAtFinal ?? null)?.getTime?.()) {
    cambios.push({
      campo: "liquidadoAt",
      valorAntes: existente.liquidadoAt ?? null,
      valorDespues: liquidadoAtFinal ?? null,
    });
  }
  if (existente.descripcion !== descripcionFinal) {
    cambios.push({ campo: "descripcion", valorAntes: existente.descripcion, valorDespues: descripcionFinal });
  }
  if (existente.tipo !== tipoFinal2) {
    cambios.push({ campo: "tipo", valorAntes: existente.tipo, valorDespues: tipoFinal2 });
  }
  if ((existente.obraId ?? null) !== (obraId ?? null)) {
    cambios.push({ campo: "obraId", valorAntes: existente.obraId ?? null, valorDespues: obraId ?? null });
  }
  if (Number(existente.cantidad) !== cantidad) {
    cambios.push({ campo: "cantidad", valorAntes: existente.cantidad, valorDespues: cantidad });
  }
  if (Number(existente.precioUnitario) !== precioUnitario) {
    cambios.push({
      campo: "precioUnitario",
      valorAntes: Number(existente.precioUnitario),
      valorDespues: precioUnitario,
    });
  }

  let saldoPendienteFinal = toDecimal2(0);
  if (tipoFinal2 === "venta") {
    if (liquidadoAtFinal) {
      saldoPendienteFinal = toDecimal2(0);
    } else if (reopeningVenta) {
      saldoPendienteFinal = toDecimal2(total);
    } else {
      const oldTotal = Number(existente.total);
      const oldPend = Number(existente.saldoPendiente ?? existente.total);
      const delta = total - oldTotal;
      let newPend = oldPend + delta;
      if (!Number.isFinite(newPend) || newPend < 0) newPend = 0;
      if (newPend > total) newPend = total;
      saldoPendienteFinal = toDecimal2(newPend);
    }
  }

  const updated = await prisma.movimiento.update({
    where: { id: movimientoId },
    data: {
      fecha: fechaFinal,
      notas: notasFinal,
      comprobante: compStr,
      normalizedComprobante: patch.comprobante !== undefined ? normalizedNext : existente.normalizedComprobante,
      codigoProducto: codigoProductoFinal,
      medioPago: medioPagoFinal,
      estadoCheque: estadoChequeFinal,
      chequeNumero: chequeNumeroFinal,
      chequeBanco: chequeBancoFinal,
      chequeVencimiento: chequeVencimientoFinal,
      fechaRecepcion: fechaRecepcionFinal,
      liquidadoAt: liquidadoAtFinal,
      descripcion: descripcionFinal,
      tipo: tipoFinal2,
      cantidad,
      precioUnitario: toDecimal2(precioUnitario),
      total: toDecimal2(total),
      saldoPendiente: saldoPendienteFinal,
      obraId,
    },
  });

  await auditLogCambio({ entidad: "movimiento", entidadId: movimientoId, cambios });

  return updated;
}

/**
 * Devolución de mercadería sobre una línea de venta: crea un movimiento `devolucion` y deja la venta
 * con saldo pendiente en cero (no usa `liquidadoAt`, para no contarla como «pagada» en comprobantes).
 */
export async function registrarDevolucionSobreVenta(
  ventaMovimientoId: string,
  opts?: { cantidad?: number },
) {
  return prisma.$transaction(async (tx) => {
    const v = await tx.movimiento.findFirst({
      where: { id: ventaMovimientoId, tipo: "venta" },
    });
    if (!v) throw new Error("Movimiento no encontrado o no es una venta.");

    const saldoPendienteMonto = Number(v.saldoPendiente ?? v.total ?? 0);
    if (!Number.isFinite(saldoPendienteMonto) || !(saldoPendienteMonto > 0)) {
      throw new Error("La venta no tiene saldo pendiente para registrar una devolución.");
    }
    const precioUnitario = Number(v.precioUnitario ?? 0);
    const cantidadVenta = Number(v.cantidad ?? 0);
    const cantidadPendiente =
      precioUnitario > 0 && Number.isFinite(cantidadVenta) && cantidadVenta > 0
        ? Math.max(0, Math.min(cantidadVenta, saldoPendienteMonto / precioUnitario))
        : 1;
    const cantidadPedida = opts?.cantidad;
    const cantidadDevolver =
      cantidadPedida == null || Number.isNaN(cantidadPedida) ? cantidadPendiente : Number(cantidadPedida);
    if (!Number.isFinite(cantidadDevolver) || !(cantidadDevolver > 0)) {
      throw new Error("La cantidad a devolver debe ser mayor a 0.");
    }
    if (cantidadDevolver - cantidadPendiente > 0.000001) {
      throw new Error("La cantidad a devolver supera la cantidad pendiente de la venta.");
    }
    const monto = Math.min(
      saldoPendienteMonto,
      precioUnitario > 0 ? cantidadDevolver * precioUnitario : saldoPendienteMonto,
    );
    const saldoPendienteRestante = Math.max(0, saldoPendienteMonto - monto);

    const baseDesc = v.descripcion?.trim() || "Venta";
    const detalleCantidad =
      cantidadDevolver + 0.000001 < cantidadPendiente ? ` (${cantidadDevolver} u)` : "";
    const descripcionRaw = `Devolución${detalleCantidad} — ${baseDesc}`;
    const descripcion = descripcionRaw.length > 2000 ? `${descripcionRaw.slice(0, 1980)}…` : descripcionRaw;

    const dev = await tx.movimiento.create({
      data: {
        clienteId: v.clienteId,
        obraId: v.obraId,
        archivoId: null,
        tipo: "devolucion",
        fecha: new Date(),
        comprobante: v.comprobante?.trim() ?? null,
        normalizedComprobante: v.normalizedComprobante,
        codigoProducto: v.codigoProducto ?? null,
        descripcion,
        cantidad: cantidadDevolver,
        precioUnitario: toDecimal2(precioUnitario > 0 ? precioUnitario : monto),
        total: toDecimal2(monto),
        saldoPendiente: toDecimal2(0),
        medioPago: null,
        chequeNumero: null,
        chequeBanco: null,
        chequeVencimiento: null,
        fechaRecepcion: null,
      },
    });

    const notaMarca = `Devolución registrada (mov. ${dev.id}, cantidad ${cantidadDevolver}, monto ${monto.toFixed(2)}).`;
    const notasNext =
      v.notas && String(v.notas).trim().length > 0
        ? `${String(v.notas).trim()}\n${notaMarca}`
        : notaMarca;

    await tx.movimiento.update({
      where: { id: ventaMovimientoId },
      data: {
        saldoPendiente: toDecimal2(saldoPendienteRestante),
        notas: notasNext.length > 8000 ? notasNext.slice(0, 8000) : notasNext,
      },
    });

    return dev;
  });
}

export async function eliminarMovimiento(movimientoId: string) {
  const r = await prisma.movimiento.deleteMany({
    where: { id: movimientoId },
  });
  return r.count > 0;
}
