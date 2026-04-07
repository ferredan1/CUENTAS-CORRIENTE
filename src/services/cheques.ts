import { prisma } from "@/lib/prisma";

/** Literales: enums de Prisma pueden ser undefined en RSC/Turbopack al leer `.pago` / `.cheque`. */
const TIPO_PAGO = "pago" as const;
const MEDIO_CHEQUE = "cheque" as const;

export type ChequeListItem = {
  id: string;
  fecha: string;
  fechaRecepcion: string | null;
  chequeVencimiento: string | null;
  chequeNumero: string | null;
  chequeBanco: string | null;
  estadoCheque: "en_cartera" | "depositado" | "acreditado" | "rechazado" | null;
  total: number;
  descripcion: string;
  clienteId: string;
  clienteNombre: string;
  obraId: string | null;
  obraNombre: string | null;
  estado: "vencido" | "por_vencer" | "sin_vencimiento";
};

function estadoCheque(vto: Date | null): ChequeListItem["estado"] {
  if (!vto || Number.isNaN(vto.getTime())) return "sin_vencimiento";
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const v = new Date(vto);
  v.setHours(0, 0, 0, 0);
  return v < hoy ? "vencido" : "por_vencer";
}

function toIso(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString();
}

export async function listarCheques(opts?: { limit?: number }): Promise<ChequeListItem[]> {
  const take = Math.min(Math.max(opts?.limit ?? 1000, 1), 3000);
  const rows = await prisma.movimiento.findMany({
    where: {
      tipo: TIPO_PAGO,
      medioPago: MEDIO_CHEQUE,
    },
    orderBy: [{ chequeVencimiento: "asc" }, { fecha: "desc" }],
    take,
    include: {
      cliente: { select: { id: true, nombre: true } },
      obra: { select: { id: true, nombre: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    fecha: r.fecha.toISOString(),
    fechaRecepcion: toIso(r.fechaRecepcion),
    chequeVencimiento: toIso(r.chequeVencimiento),
    chequeNumero: r.chequeNumero,
    chequeBanco: (r as { chequeBanco?: string | null }).chequeBanco ?? null,
    estadoCheque: (r as { estadoCheque?: ChequeListItem["estadoCheque"] }).estadoCheque ?? null,
    total: Number(r.total),
    descripcion: r.descripcion,
    clienteId: r.cliente.id,
    clienteNombre: r.cliente.nombre,
    obraId: r.obra?.id ?? null,
    obraNombre: r.obra?.nombre ?? null,
    estado: estadoCheque(r.chequeVencimiento),
  }));
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export type ResumenCheques = {
  porVencerEn7: number;
  vencidos: number;
};

/** Resumen liviano para widgets (sin traer toda la tabla). */
export async function resumirCheques(): Promise<ResumenCheques> {
  const hoy = startOfToday();
  const hasta = addDays(hoy, 7);

  const [porVencerEn7, vencidos] = await Promise.all([
    prisma.movimiento.count({
      where: {
        tipo: TIPO_PAGO,
        medioPago: MEDIO_CHEQUE,
        chequeVencimiento: { gte: hoy, lte: hasta },
      },
    }),
    prisma.movimiento.count({
      where: {
        tipo: TIPO_PAGO,
        medioPago: MEDIO_CHEQUE,
        chequeVencimiento: { lt: hoy },
      },
    }),
  ]);

  return { porVencerEn7, vencidos };
}
