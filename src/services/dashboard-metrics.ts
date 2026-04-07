import { prisma } from "@/lib/prisma";
import { boundsDiaLocal } from "@/lib/day-bounds";

/** Literal: no usar `TipoMovimiento` de Prisma aquí (puede ser undefined en RSC/Turbopack). */
const TIPO_PAGO = "pago" as const;

export type ActividadReciente = {
  ultimoMovimiento: {
    fecha: Date;
    tipo: string;
    descripcion: string;
    clienteNombre: string;
    clienteId: string;
  } | null;
  ultimoPdf: {
    createdAt: Date;
    nombre: string | null;
    clienteNombre: string;
    clienteId: string;
  } | null;
  ultimoCliente: {
    id: string;
    nombre: string;
    createdAt: Date;
  } | null;
  ultimoMovimientoProveedor: {
    fecha: Date;
    tipo: string;
    descripcion: string;
    proveedorId: string;
    proveedorNombre: string;
  } | null;
  ultimoProveedor: {
    id: string;
    nombre: string;
    createdAt: Date;
  } | null;
};

export async function obtenerActividadReciente(): Promise<ActividadReciente> {
  const [
    ultimoMovimiento,
    ultimoPdf,
    ultimoCliente,
    ultimoMovimientoProveedor,
    ultimaCompraMarcadaPagada,
    ultimoProveedor,
  ] =
    await Promise.all([
      prisma.movimiento.findFirst({
        orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
        select: {
          fecha: true,
          tipo: true,
          descripcion: true,
          cliente: { select: { id: true, nombre: true } },
        },
      }),
      prisma.archivo.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          nombre: true,
          cliente: { select: { id: true, nombre: true } },
        },
      }),
      prisma.cliente.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true, nombre: true, createdAt: true },
      }),
      prisma.movimientoProveedor.findFirst({
        orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
        select: {
          fecha: true,
          tipo: true,
          descripcion: true,
          proveedor: { select: { id: true, nombre: true } },
        },
      }),
      prisma.movimientoProveedor.findFirst({
        where: { tipo: "compra", liquidadoAt: { not: null } },
        orderBy: [{ liquidadoAt: "desc" }, { updatedAt: "desc" }],
        select: {
          liquidadoAt: true,
          descripcion: true,
          proveedor: { select: { id: true, nombre: true } },
        },
      }),
      prisma.proveedor.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true, nombre: true, createdAt: true },
      }),
    ]);

  const ultimoProvNatural = ultimoMovimientoProveedor
    ? {
        fecha: ultimoMovimientoProveedor.fecha,
        tipo: ultimoMovimientoProveedor.tipo,
        descripcion: ultimoMovimientoProveedor.descripcion,
        proveedorId: ultimoMovimientoProveedor.proveedor.id,
        proveedorNombre: ultimoMovimientoProveedor.proveedor.nombre,
      }
    : null;

  const ultimoProvPagoMarcado = ultimaCompraMarcadaPagada?.liquidadoAt
    ? {
        fecha: ultimaCompraMarcadaPagada.liquidadoAt,
        tipo: "pago",
        descripcion: `Compra marcada como pagada · ${ultimaCompraMarcadaPagada.descripcion}`,
        proveedorId: ultimaCompraMarcadaPagada.proveedor.id,
        proveedorNombre: ultimaCompraMarcadaPagada.proveedor.nombre,
      }
    : null;

  const ultimoProv =
    !ultimoProvNatural && !ultimoProvPagoMarcado
      ? null
      : !ultimoProvNatural
        ? ultimoProvPagoMarcado
        : !ultimoProvPagoMarcado
          ? ultimoProvNatural
          : ultimoProvNatural.fecha >= ultimoProvPagoMarcado.fecha
            ? ultimoProvNatural
            : ultimoProvPagoMarcado;

  return {
    ultimoMovimiento: ultimoMovimiento
      ? {
          fecha: ultimoMovimiento.fecha,
          tipo: ultimoMovimiento.tipo,
          descripcion: ultimoMovimiento.descripcion,
          clienteNombre: ultimoMovimiento.cliente.nombre,
          clienteId: ultimoMovimiento.cliente.id,
        }
      : null,
    ultimoPdf: ultimoPdf
      ? {
          createdAt: ultimoPdf.createdAt,
          nombre: ultimoPdf.nombre,
          clienteNombre: ultimoPdf.cliente.nombre,
          clienteId: ultimoPdf.cliente.id,
        }
      : null,
    ultimoCliente: ultimoCliente,
    ultimoMovimientoProveedor: ultimoProv,
    ultimoProveedor: ultimoProveedor,
  };
}

export async function contarPagosHoy(): Promise<number> {
  const { desde, hasta } = boundsDiaLocal();
  return prisma.movimiento.count({
    where: {
      tipo: TIPO_PAGO,
      fecha: { gte: desde, lte: hasta },
    },
  });
}

/** Suma importes de movimientos tipo pago del día (local). */
export async function importeCobrosHoy(): Promise<number> {
  const { desde, hasta } = boundsDiaLocal();
  const r = await prisma.movimiento.aggregate({
    where: {
      tipo: TIPO_PAGO,
      fecha: { gte: desde, lte: hasta },
    },
    _sum: { total: true },
  });
  return Number(r._sum.total ?? 0);
}

/** Suma saldo pendiente de ventas con más de 60 días de antigüedad. */
export async function totalSaldoVencidoMas60Dias(): Promise<number> {
  const corte = new Date();
  corte.setDate(corte.getDate() - 60);
  const r = await prisma.movimiento.aggregate({
    where: {
      tipo: "venta",
      saldoPendiente: { gt: 0 },
      fecha: { lt: corte },
    },
    _sum: { saldoPendiente: true },
  });
  return Number(r._sum.saldoPendiente ?? 0);
}

export async function contarArchivosSubidosHoy(): Promise<number> {
  const { desde, hasta } = boundsDiaLocal();
  return prisma.archivo.count({
    where: {
      createdAt: { gte: desde, lte: hasta },
    },
  });
}
