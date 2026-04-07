import { normalizarComprobanteParaDuplicado } from "@/domain/comprobantes/normalize";
import { calcularTotalMovimiento } from "@/domain/movimientos/rules";
import { toDecimal2 } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import { archivoDelCliente } from "@/services/archivos";

const TIPO_VENTA = "venta" as const;

export type ItemImportar = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario?: number;
};

export class ComprobanteDuplicadoError extends Error {
  override name = "ComprobanteDuplicadoError";

  constructor(comprobanteEnBd: string) {
    super(
      `Ya existen ventas para este cliente con el mismo número de comprobante («${comprobanteEnBd}»). ` +
        `Si es el mismo papel, no hace falta volver a importarlo.`,
    );
  }
}

async function existeComprobanteCliente(
  clienteId: string,
  comprobanteNuevo: string,
): Promise<string | null> {
  const clave = normalizarComprobanteParaDuplicado(comprobanteNuevo);
  if (clave.length < 2) return null;

  const byNorm = await prisma.movimiento.findFirst({
    where: {
      clienteId,
      tipo: TIPO_VENTA,
      normalizedComprobante: clave,
    },
    select: { comprobante: true },
  });
  if (byNorm?.comprobante) return byNorm.comprobante;

  const legacy = await prisma.movimiento.findMany({
    where: {
      clienteId,
      tipo: TIPO_VENTA,
      comprobante: { not: null },
      normalizedComprobante: null,
    },
    select: { comprobante: true },
  });
  for (const row of legacy) {
    if (row.comprobante && normalizarComprobanteParaDuplicado(row.comprobante) === clave) {
      return row.comprobante;
    }
  }
  return null;
}

export async function importarComprobanteVentas(params: {
    clienteId: string;
    obraId?: string | null;
    comprobante: string;
    archivoId: string;
    items: ItemImportar[];
    fecha?: Date;
    /** Si viene, se actualiza la extracción ligada al pipeline de PDF. */
    extraccionId?: string | null;
}) {
  const arch = await archivoDelCliente(params.archivoId, params.clienteId);
  if (!arch) {
    throw new Error("Comprobante PDF no válido para este cliente.");
  }

  if (params.obraId) {
    const obra = await prisma.obra.findFirst({
      where: { id: params.obraId, clienteId: params.clienteId },
      select: { id: true },
    });
    if (!obra) throw new Error("Obra no válida para el cliente.");
  }

  const dup = await existeComprobanteCliente(params.clienteId, params.comprobante);
  if (dup) {
    throw new ComprobanteDuplicadoError(dup);
  }

  const fecha = params.fecha ?? new Date();
  const compTrim = params.comprobante.trim();
  const normKey = normalizarComprobanteParaDuplicado(compTrim);
  const normalizedComprobante = normKey.length >= 2 ? normKey : null;

  const rows = params.items.map((item) => {
    const pu =
      item.precioUnitario !== undefined && Number.isFinite(Number(item.precioUnitario))
        ? Number(item.precioUnitario)
        : 0;
    const cantidad = Number(item.cantidad);
    const total = calcularTotalMovimiento(cantidad, pu);
    return {
      clienteId: params.clienteId,
      obraId: params.obraId ?? null,
      archivoId: params.archivoId,
      tipo: TIPO_VENTA,
      fecha,
      comprobante: compTrim,
      normalizedComprobante,
      codigoProducto: item.codigo === "-" ? null : item.codigo,
      descripcion: item.descripcion.trim(),
      cantidad,
      precioUnitario: toDecimal2(pu),
      total: toDecimal2(total),
      saldoPendiente: toDecimal2(total),
    };
  });

  return prisma.$transaction(async (tx) => {
    await tx.movimiento.createMany({ data: rows });
    await tx.archivo.update({
      where: { id: params.archivoId },
      data: { estado: "importado" },
    });
    const movs = await tx.movimiento.findMany({
      where: {
        archivoId: params.archivoId,
        comprobante: compTrim,
        tipo: TIPO_VENTA,
      },
      orderBy: { createdAt: "asc" },
    });
    const exId = params.extraccionId?.trim();
    if (exId && movs[0]?.id) {
      const ex = await tx.extraccionArchivo.findUnique({
        where: { id: exId },
        select: { importadoComoMovId: true },
      });
      await tx.extraccionArchivo.update({
        where: { id: exId },
        data: {
          estado: "ok",
          importadoComoMovId: ex?.importadoComoMovId ?? movs[0]!.id,
        },
      });
    }
    return movs;
  });
}
