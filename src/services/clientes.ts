import { Prisma, type EstadoGestionCuenta, type TipoCliente } from "@prisma/client";
import { Buffer } from "node:buffer";
import { normalizarComprobanteParaDuplicado } from "@/domain/comprobantes/normalize";
import type { FiltroClientesTabla, OrdenClientesTabla } from "@/types/clientes-tabla";
import { esEstadoGestionCuenta } from "@/types/estado-gestion-cuenta";
import { prisma } from "@/lib/prisma";
import { tryRemoveStoredFile } from "@/services/archivos";
import { auditLogEliminacion } from "@/services/audit";
import {
  cargarAnticiposEnPagos,
  mapImputacionAnticipoPorPagoIds,
  sumAnticipoPagosPorCliente,
} from "@/services/cartera-pago-anticipo";
import { saldoDesdeTotalesPorTipo, saldoEfectivoConCheques } from "@/domain/saldos";
import { esTipoCliente } from "@/types/domain";

export type EstadoCobranza = "al_dia" | "en_gestion" | "moroso" | "incobrable";

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

function diasEntre(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function estadoCobranzaDesdeSaldoYDias(saldo: number, diasDesdeUltimaVentaImpaga: number | null): EstadoCobranza {
  if (!(saldo > 0)) return "al_dia";
  const dias = diasDesdeUltimaVentaImpaga ?? 0;
  if (dias <= 30) return "en_gestion";
  if (dias <= 90) return "moroso";
  return "incobrable";
}

/**
 * Cartera coherente con pagos parciales: ventas suman `saldoPendiente`.
 * Los `pago` solo restan la parte no imputada a ventas (anticipo), porque el cobro que cerró o
 * bajó `saldoPendiente` no debe volver a restarse al agregarlo como `total` del pago.
 */
async function totalesMovimientoPorClienteParaSaldo(
  opts?: { clienteIdIn?: string[] },
): Promise<Map<string, Record<string, number>>> {
  const idPart =
    opts?.clienteIdIn && opts.clienteIdIn.length > 0 ? { clienteId: { in: opts.clienteIdIn } } : {};

  const [ventaAgg, otroAgg, anticipoPorCliente] = await Promise.all([
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { tipo: "venta", ...idPart },
      _sum: { saldoPendiente: true },
    }),
    prisma.movimiento.groupBy({
      by: ["clienteId", "tipo"],
      where: { tipo: { notIn: ["venta", "pago"] }, ...idPart },
      _sum: { total: true },
    }),
    sumAnticipoPagosPorCliente(
      opts?.clienteIdIn && opts.clienteIdIn.length > 0 ? { clienteIdIn: opts.clienteIdIn } : undefined,
    ),
  ]);

  const porCliente = new Map<string, Record<string, number>>();
  for (const g of ventaAgg) {
    porCliente.set(g.clienteId, {
      ...(porCliente.get(g.clienteId) ?? {}),
      venta: Number(g._sum.saldoPendiente ?? 0),
    });
  }
  for (const g of otroAgg) {
    const prev = porCliente.get(g.clienteId) ?? {};
    prev[g.tipo] = Number(g._sum.total ?? 0);
    porCliente.set(g.clienteId, prev);
  }
  for (const [clienteId, anticipo] of anticipoPorCliente) {
    const prev = porCliente.get(clienteId) ?? {};
    prev.pago = anticipo;
    porCliente.set(clienteId, prev);
  }
  return porCliente;
}

/** Venta con deuda pendiente (coherente con pagos parciales). */
const filtroVentaImpaga = { tipo: "venta" as const, saldoPendiente: { gt: 0 as const } };

export function clienteBusquedaWhere(q: string): Prisma.ClienteWhereInput {
  const qq = q.trim();
  const norm = normalizarComprobanteParaDuplicado(qq);
  const movimientoOr: Prisma.MovimientoWhereInput[] = [
    { comprobante: { contains: qq, mode: "insensitive" as const } },
  ];
  if (norm.length >= 2) {
    movimientoOr.push({
      normalizedComprobante: { contains: norm, mode: "insensitive" as const },
    });
  }

  return {
    OR: [
      { nombre: { contains: qq, mode: "insensitive" as const } },
      { nombrePersona: { contains: qq, mode: "insensitive" as const } },
      { apellido: { contains: qq, mode: "insensitive" as const } },
      { email: { contains: qq, mode: "insensitive" as const } },
      { cuit: { contains: qq, mode: "insensitive" as const } },
      { telefono: { contains: qq, mode: "insensitive" as const } },
      {
        movimientos: {
          some: {
            OR: movimientoOr,
          },
        },
      },
    ],
  };
}

export async function listarClientesConSaldo(
  busqueda?: string,
  opts?: { limit?: number },
) {
  const q = busqueda?.trim();
  const take = Math.min(Math.max(opts?.limit ?? 2000, 1), 5000);
  const clientes = await prisma.cliente.findMany({
    where: {
      ...(q ? clienteBusquedaWhere(q) : {}),
    },
    orderBy: { nombre: "asc" },
    take,
  });

  if (clientes.length === 0) return [];

  const ids = clientes.map((c) => c.id);
  const [porCliente, ultVentaImpaga, ultMov] = await Promise.all([
    totalesMovimientoPorClienteParaSaldo({ clienteIdIn: ids }),
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids }, ...filtroVentaImpaga },
      _max: { fecha: true },
    }),
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids } },
      _max: { fecha: true },
    }),
  ]);
  const ultVentaImpagaByClienteId = new Map<string, Date>();
  for (const g of ultVentaImpaga) {
    if (g._max.fecha) ultVentaImpagaByClienteId.set(g.clienteId, g._max.fecha);
  }
  const ultMovByClienteId = new Map<string, Date>();
  for (const g of ultMov) {
    if (g._max.fecha) ultMovByClienteId.set(g.clienteId, g._max.fecha);
  }
  const hoy = new Date();

  return clientes.map((c) => {
    const saldo = saldoDesdeTotalesPorTipo(porCliente.get(c.id) ?? {});
    const fechaUlt = ultVentaImpagaByClienteId.get(c.id) ?? null;
    const ult = ultMovByClienteId.get(c.id) ?? null;
    return {
      ...c,
      saldo,
      estadoCobranza: estadoCobranzaDesdeSaldoYDias(
        saldo,
        diasParaCobranzaDesdeRefs(fechaUlt, ult, hoy),
      ),
    };
  });
}

export function encodeClienteCursor(nombre: string, id: string): string {
  return Buffer.from(JSON.stringify({ nombre, id }), "utf8").toString("base64url");
}

function decodeClienteCursor(cursor: string | null | undefined): { nombre: string; id: string } | null {
  if (!cursor?.trim()) return null;
  try {
    const raw = Buffer.from(cursor.trim(), "base64url").toString("utf8");
    const j = JSON.parse(raw) as { nombre?: string; id?: string };
    if (typeof j.nombre === "string" && typeof j.id === "string") return { nombre: j.nombre, id: j.id };
  } catch {
    /* ignore */
  }
  return null;
}

export type ClienteConSaldo = Awaited<ReturnType<typeof listarClientesConSaldo>>[number];

/** Cursor + lotes: el filtro local en panel sigue aplicando solo sobre filas cargadas (plan v7 opción B). */
export async function listarClientesConSaldoPaginated(
  busqueda: string | undefined,
  limit: number,
  cursor: string | null,
): Promise<{ clientes: ClienteConSaldo[]; nextCursor: string | null }> {
  const q = busqueda?.trim();
  const take = Math.min(Math.max(limit, 1), 200);
  const cur = decodeClienteCursor(cursor);

  const parts: Prisma.ClienteWhereInput[] = [];
  if (q) parts.push(clienteBusquedaWhere(q));
  if (cur) {
    parts.push({
      OR: [
        { nombre: { gt: cur.nombre } },
        { AND: [{ nombre: cur.nombre }, { id: { gt: cur.id } }] },
      ],
    });
  }

  const rows = await prisma.cliente.findMany({
    where: parts.length ? { AND: parts } : {},
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
    take: take + 1,
  });

  const page = rows.slice(0, take);
  const hasMore = rows.length > take;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeClienteCursor(last.nombre, last.id) : null;

  if (page.length === 0) return { clientes: [], nextCursor: null };

  const ids = page.map((c) => c.id);
  const [porCliente, ultVentaImpaga, ultMov, deudaMas90] = await Promise.all([
    totalesMovimientoPorClienteParaSaldo({ clienteIdIn: ids }),
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids }, ...filtroVentaImpaga },
      _max: { fecha: true },
    }),
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids } },
      _max: { fecha: true },
    }),
    (() => {
      const fecha90 = new Date();
      fecha90.setDate(fecha90.getDate() - 90);
      return prisma.movimiento.groupBy({
        by: ["clienteId"],
        where: {
          clienteId: { in: ids },
          ...filtroVentaImpaga,
          fecha: { lt: fecha90 },
        },
        _sum: { saldoPendiente: true },
      });
    })(),
  ]);
  const deudaMas90ByClienteId = new Map<string, number>();
  for (const g of deudaMas90) {
    deudaMas90ByClienteId.set(g.clienteId, Number(g._sum.saldoPendiente ?? 0));
  }
  const ultVentaImpagaByClienteId = new Map<string, Date>();
  for (const g of ultVentaImpaga) {
    if (g._max.fecha) ultVentaImpagaByClienteId.set(g.clienteId, g._max.fecha);
  }
  const ultMovByClienteId = new Map<string, Date>();
  for (const g of ultMov) {
    if (g._max.fecha) ultMovByClienteId.set(g.clienteId, g._max.fecha);
  }
  const hoy = new Date();

  const clientes = page.map((c) => {
    const saldo = saldoDesdeTotalesPorTipo(porCliente.get(c.id) ?? {});
    const fechaUlt = ultVentaImpagaByClienteId.get(c.id) ?? null;
    const ult = ultMovByClienteId.get(c.id) ?? null;
    return {
      ...c,
      saldo,
      deudaMas90: deudaMas90ByClienteId.get(c.id) ?? 0,
      estadoCobranza: estadoCobranzaDesdeSaldoYDias(
        saldo,
        diasParaCobranzaDesdeRefs(fechaUlt, ult, hoy),
      ),
    };
  });

  return { clientes, nextCursor };
}

const MAX_TABLA_CLIENTES = 4000;
const EPS_SALDO = 1e-6;

/** Días desde la última venta impaga; si hay deuda sin fila «venta» impaga (p. ej. ajustes), usa el último movimiento. */
function diasSinPagarDesdeRefs(
  saldo: number,
  fechaUltVentaImpaga: Date | null,
  ultimoMovimientoFecha: Date | null,
  hoy: Date,
): number | null {
  if (!(saldo > EPS_SALDO)) return null;
  const ref = fechaUltVentaImpaga ?? ultimoMovimientoFecha;
  if (!ref) return 0;
  return diasEntre(hoy, ref);
}

function diasParaCobranzaDesdeRefs(
  fechaUltVentaImpaga: Date | null,
  ultimoMovimientoFecha: Date | null,
  hoy: Date,
): number | null {
  const ref = fechaUltVentaImpaga ?? ultimoMovimientoFecha;
  if (!ref) return null;
  return diasEntre(hoy, ref);
}

export type { FiltroClientesTabla, OrdenClientesTabla } from "@/types/clientes-tabla";

export type ClienteListadoTabla = ClienteConSaldo & {
  deudaMas90: number;
  diasSinPagar: number | null;
  saldoVencido60: number;
  ultimoMovimientoFecha: Date | null;
  obrasCount: number;
  obrasEstado: { id: string; nombre: string; estadoGestionCuenta: EstadoGestionCuenta }[];
};

type TablaCursor =
  | { t: "n"; nombre: string; id: string }
  | { t: "s"; saldo: number; id: string }
  | { t: "d"; dias: number; id: string };

export function parseFiltroClientesTabla(raw: string | null | undefined): FiltroClientesTabla {
  const v = (raw ?? "todos").toLowerCase().replace(/-/g, "_");
  if (v === "con_deuda" || v === "al_dia" || v === "vencidos" || v === "sin_movimientos") {
    return v as FiltroClientesTabla;
  }
  return "todos";
}

export function parseOrdenClientesTabla(raw: string | null | undefined): OrdenClientesTabla {
  const v = (raw ?? "nombre").toLowerCase().replace(/-/g, "_");
  if (v === "saldo") return "saldo";
  if (v === "dias_sin_pagar") return "dias_sin_pagar";
  return "nombre";
}

function encodeTablaCursor(c: TablaCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

function decodeTablaCursor(cursor: string | null | undefined): TablaCursor | null {
  if (!cursor?.trim()) return null;
  try {
    const raw = Buffer.from(cursor.trim(), "base64url").toString("utf8");
    const j = JSON.parse(raw) as TablaCursor;
    if (j.t === "n" && typeof j.nombre === "string" && typeof j.id === "string") return j;
    if (j.t === "s" && typeof j.saldo === "number" && typeof j.id === "string") return j;
    if (j.t === "d" && typeof j.dias === "number" && typeof j.id === "string") return j;
  } catch {
    /* ignore */
  }
  return null;
}

function diasSortKeyCliente(d: number | null): number {
  if (d == null || !Number.isFinite(d)) return -1;
  return d;
}

function findStartNombre(sorted: ClienteListadoTabla[], cur: { nombre: string; id: string }): number {
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    const cmp = r.nombre.localeCompare(cur.nombre, "es");
    if (cmp > 0) return i;
    if (cmp === 0 && r.id > cur.id) return i;
  }
  return sorted.length;
}

function findStartSaldo(sorted: ClienteListadoTabla[], cur: { saldo: number; id: string }): number {
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    if (r.saldo < cur.saldo - EPS_SALDO) return i;
    if (Math.abs(r.saldo - cur.saldo) <= EPS_SALDO && r.id > cur.id) return i;
  }
  return sorted.length;
}

function findStartDias(sorted: ClienteListadoTabla[], cur: { dias: number; id: string }): number {
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    const rk = diasSortKeyCliente(r.diasSinPagar);
    if (rk < cur.dias) return i;
    if (rk === cur.dias && r.id > cur.id) return i;
  }
  return sorted.length;
}

/**
 * Listado de clientes con filtros, orden servidor y cursor (hasta MAX_TABLA_CLIENTES filas del usuario).
 */
export async function listarClientesParaTabla(opts: {
  busqueda?: string;
  filtro: FiltroClientesTabla;
  orderBy: OrdenClientesTabla;
  limit: number;
  cursor: string | null;
}): Promise<{ clientes: ClienteListadoTabla[]; nextCursor: string | null }> {
  const q = opts.busqueda?.trim();
  const takeCap = Math.min(Math.max(opts.limit, 1), 200);
  const curDecode = decodeTablaCursor(opts.cursor);

  const parts: Prisma.ClienteWhereInput[] = [];
  if (q) parts.push(clienteBusquedaWhere(q));

  const base = await prisma.cliente.findMany({
    where: parts.length ? { AND: parts } : {},
    orderBy: [{ nombre: "asc" }, { id: "asc" }],
    take: MAX_TABLA_CLIENTES,
  });

  if (base.length === 0) return { clientes: [], nextCursor: null };

  const ids = base.map((c) => c.id);
  /** SQL directo: mismo criterio que obras (client Prisma a veces sin `estadoGestionCuenta` en el modelo). */
  const [obrasDetalle, clienteEstadoRows] = await Promise.all([
    prisma.$queryRaw<
      { id: string; clienteId: string; nombre: string; estadoGestionCuenta: string | null }[]
    >`
      SELECT id, "clienteId", nombre, "estadoGestionCuenta"
      FROM "Obra"
      WHERE "clienteId" IN (${Prisma.join(ids)})
      ORDER BY nombre ASC
    `,
    prisma.$queryRaw<{ id: string; estadoGestionCuenta: string | null }[]>`
      SELECT id, "estadoGestionCuenta"
      FROM "Cliente"
      WHERE id IN (${Prisma.join(ids)})
    `,
  ]);
  const estadoClientePorId = new Map<string, EstadoGestionCuenta>();
  for (const r of clienteEstadoRows) {
    estadoClientePorId.set(
      r.id,
      r.estadoGestionCuenta != null && esEstadoGestionCuenta(r.estadoGestionCuenta)
        ? r.estadoGestionCuenta
        : "FALTA_PAGO",
    );
  }
  const obrasEstadoPorCliente = new Map<
    string,
    { id: string; nombre: string; estadoGestionCuenta: EstadoGestionCuenta }[]
  >();
  for (const o of obrasDetalle) {
    const arr = obrasEstadoPorCliente.get(o.clienteId) ?? [];
    const eg =
      o.estadoGestionCuenta != null && esEstadoGestionCuenta(o.estadoGestionCuenta)
        ? o.estadoGestionCuenta
        : ("FALTA_PAGO" satisfies EstadoGestionCuenta);
    arr.push({
      id: o.id,
      nombre: o.nombre,
      estadoGestionCuenta: eg,
    });
    obrasEstadoPorCliente.set(o.clienteId, arr);
  }

  const [porCliente, ultVentaImpaga, ultMov, obrasAgg, fecha60, deudaMas90] = await Promise.all([
    totalesMovimientoPorClienteParaSaldo({ clienteIdIn: ids }),
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids }, ...filtroVentaImpaga },
      _max: { fecha: true },
    }),
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids } },
      _max: { fecha: true },
    }),
    prisma.obra.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids } },
      _count: { _all: true },
    }),
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 60);
      return d;
    })(),
    (() => {
      const fecha90 = new Date();
      fecha90.setDate(fecha90.getDate() - 90);
      return fecha90;
    })(),
  ]);

  const fecha60cut = fecha60;
  const deudaMas60 = await prisma.movimiento.groupBy({
    by: ["clienteId"],
    where: {
      clienteId: { in: ids },
      ...filtroVentaImpaga,
      fecha: { lt: fecha60cut },
    },
    _sum: { saldoPendiente: true },
  });
  const deudaMas90Agg = await prisma.movimiento.groupBy({
    by: ["clienteId"],
    where: {
      clienteId: { in: ids },
      ...filtroVentaImpaga,
      fecha: { lt: deudaMas90 },
    },
    _sum: { saldoPendiente: true },
  });

  const ultVentaImpagaByClienteId = new Map<string, Date>();
  for (const g of ultVentaImpaga) {
    if (g._max.fecha) ultVentaImpagaByClienteId.set(g.clienteId, g._max.fecha);
  }
  const ultMovByClienteId = new Map<string, Date>();
  for (const g of ultMov) {
    if (g._max.fecha) ultMovByClienteId.set(g.clienteId, g._max.fecha);
  }
  const obrasByClienteId = new Map<string, number>();
  for (const g of obrasAgg) {
    obrasByClienteId.set(g.clienteId, g._count._all);
  }
  const deudaMas60ByClienteId = new Map<string, number>();
  for (const g of deudaMas60) {
    deudaMas60ByClienteId.set(g.clienteId, Number(g._sum.saldoPendiente ?? 0));
  }
  const deudaMas90ByClienteId = new Map<string, number>();
  for (const g of deudaMas90Agg) {
    deudaMas90ByClienteId.set(g.clienteId, Number(g._sum.saldoPendiente ?? 0));
  }

  const hoy = new Date();

  const enriched: ClienteListadoTabla[] = base.map((c) => {
    const saldo = saldoDesdeTotalesPorTipo(porCliente.get(c.id) ?? {});
    const fechaUltImp = ultVentaImpagaByClienteId.get(c.id) ?? null;
    const ultMovF = ultMovByClienteId.get(c.id) ?? null;
    const diasSinPagar = diasSinPagarDesdeRefs(saldo, fechaUltImp, ultMovF, hoy);
    const diasCobranza = diasParaCobranzaDesdeRefs(fechaUltImp, ultMovF, hoy);
    return {
      ...c,
      estadoGestionCuenta: estadoClientePorId.get(c.id) ?? "FALTA_PAGO",
      saldo,
      deudaMas90: deudaMas90ByClienteId.get(c.id) ?? 0,
      estadoCobranza: estadoCobranzaDesdeSaldoYDias(saldo, diasCobranza),
      diasSinPagar,
      saldoVencido60: deudaMas60ByClienteId.get(c.id) ?? 0,
      ultimoMovimientoFecha: ultMovByClienteId.get(c.id) ?? null,
      obrasCount: obrasByClienteId.get(c.id) ?? 0,
      obrasEstado: obrasEstadoPorCliente.get(c.id) ?? [],
    };
  });

  let filtered = enriched;
  switch (opts.filtro) {
    case "con_deuda":
      filtered = enriched.filter((r) => r.saldo > EPS_SALDO);
      break;
    case "al_dia":
      filtered = enriched.filter((r) => r.saldo <= EPS_SALDO);
      break;
    case "vencidos":
      filtered = enriched.filter(
        (r) => r.saldo > EPS_SALDO && r.diasSinPagar != null && r.diasSinPagar > 60,
      );
      break;
    case "sin_movimientos":
      filtered = enriched.filter((r) => !r.ultimoMovimientoFecha);
      break;
    default:
      break;
  }

  let sorted = [...filtered];
  if (opts.orderBy === "nombre") {
    sorted.sort((a, b) => {
      const c = a.nombre.localeCompare(b.nombre, "es");
      if (c !== 0) return c;
      return a.id.localeCompare(b.id);
    });
  } else if (opts.orderBy === "saldo") {
    sorted.sort((a, b) => {
      if (b.saldo !== a.saldo) return b.saldo - a.saldo;
      return a.id.localeCompare(b.id);
    });
  } else {
    sorted.sort((a, b) => {
      const ka = diasSortKeyCliente(a.diasSinPagar);
      const kb = diasSortKeyCliente(b.diasSinPagar);
      if (kb !== ka) return kb - ka;
      return a.id.localeCompare(b.id);
    });
  }

  let start = 0;
  if (curDecode) {
    if (opts.orderBy === "nombre" && curDecode.t === "n") {
      start = findStartNombre(sorted, curDecode);
    } else if (opts.orderBy === "saldo" && curDecode.t === "s") {
      start = findStartSaldo(sorted, curDecode);
    } else if (opts.orderBy === "dias_sin_pagar" && curDecode.t === "d") {
      start = findStartDias(sorted, curDecode);
    }
  }

  const page = sorted.slice(start, start + takeCap + 1);
  const hasMore = page.length > takeCap;
  const slice = page.slice(0, takeCap);
  const last = slice[slice.length - 1];
  let nextCursor: string | null = null;
  if (hasMore && last) {
    if (opts.orderBy === "nombre") {
      nextCursor = encodeTablaCursor({ t: "n", nombre: last.nombre, id: last.id });
    } else if (opts.orderBy === "saldo") {
      nextCursor = encodeTablaCursor({ t: "s", saldo: last.saldo, id: last.id });
    } else {
      nextCursor = encodeTablaCursor({
        t: "d",
        dias: diasSortKeyCliente(last.diasSinPagar),
        id: last.id,
      });
    }
  }

  return { clientes: slice, nextCursor };
}

/** Vista previa en el panel (debajo de actividad reciente): prioriza deudores por saldo; sin CUIT ni teléfono. */
export type ClienteVistaPreviaPanel = {
  id: string;
  nombre: string;
  tipo: string;
  saldo: number;
  deudaMas90: number;
  estadoCobranza: EstadoCobranza;
  diasSinPagar: number | null;
  obrasCount: number;
};

export async function listarClientesVistaPreviaPanel(
  limit = 15,
): Promise<ClienteVistaPreviaPanel[]> {
  const take = Math.min(Math.max(limit, 1), 40);
  const [porCliente, todosClientes] = await Promise.all([
    totalesMovimientoPorClienteParaSaldo(),
    prisma.cliente.findMany({
      select: { id: true, nombre: true, tipo: true },
    }),
  ]);

  const rows = todosClientes.map((c) => {
    const saldo = saldoDesdeTotalesPorTipo(porCliente.get(c.id) ?? {});
    return {
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      saldo,
    };
  });

  rows.sort((a, b) => {
    const aDeuda = a.saldo > 0 ? 1 : 0;
    const bDeuda = b.saldo > 0 ? 1 : 0;
    if (aDeuda !== bDeuda) return bDeuda - aDeuda;
    if (a.saldo > 0 && b.saldo > 0) return b.saldo - a.saldo;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  const picked = rows.slice(0, take);
  if (picked.length === 0) return [];

  const ids = picked.map((p) => p.id);
  const fecha90 = new Date();
  fecha90.setDate(fecha90.getDate() - 90);
  const hoy = new Date();

  const [ultVentaImpaga, ultMovAgg, deudaMas90Agg, obrasAgg] = await Promise.all([
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids }, ...filtroVentaImpaga },
      _max: { fecha: true },
    }),
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids } },
      _max: { fecha: true },
    }),
    prisma.movimiento.groupBy({
      by: ["clienteId"],
      where: {
        clienteId: { in: ids },
        ...filtroVentaImpaga,
        fecha: { lt: fecha90 },
      },
      _sum: { saldoPendiente: true },
    }),
    prisma.obra.groupBy({
      by: ["clienteId"],
      where: { clienteId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const ultVentaById = new Map<string, Date>();
  for (const g of ultVentaImpaga) {
    if (g._max.fecha) ultVentaById.set(g.clienteId, g._max.fecha);
  }
  const ultMovById = new Map<string, Date>();
  for (const g of ultMovAgg) {
    if (g._max.fecha) ultMovById.set(g.clienteId, g._max.fecha);
  }
  const deudaMas90ById = new Map<string, number>();
  for (const g of deudaMas90Agg) {
    deudaMas90ById.set(g.clienteId, Number(g._sum.saldoPendiente ?? 0));
  }
  const obrasById = new Map<string, number>();
  for (const g of obrasAgg) {
    obrasById.set(g.clienteId, g._count._all);
  }

  return picked.map((p) => {
    const fechaUlt = ultVentaById.get(p.id) ?? null;
    const ultMov = ultMovById.get(p.id) ?? null;
    const diasSinPagar = diasSinPagarDesdeRefs(p.saldo, fechaUlt, ultMov, hoy);
    const diasCob = diasParaCobranzaDesdeRefs(fechaUlt, ultMov, hoy);
    const estadoCobranza = estadoCobranzaDesdeSaldoYDias(p.saldo, diasCob);
    return {
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      saldo: p.saldo,
      deudaMas90: deudaMas90ById.get(p.id) ?? 0,
      estadoCobranza,
      diasSinPagar,
      obrasCount: obrasById.get(p.id) ?? 0,
    };
  });
}

/** KPIs del panel sin cargar todos los clientes en memoria. */
export async function resumenCarteraPanel() {
  const porCliente = await totalesMovimientoPorClienteParaSaldo();
  let totalCartera = 0;
  let morosos = 0;
  for (const tot of porCliente.values()) {
    const saldo = saldoDesdeTotalesPorTipo(tot);
    if (saldo > 0) {
      morosos += 1;
      totalCartera += saldo;
    }
  }
  const clientesCount = await prisma.cliente.count();
  return { totalCartera, morosos, clientesCount };
}

export async function obtenerCliente(clienteId: string) {
  const [
    cliente,
    ventaObraAgg,
    otroObraAgg,
    anticipoPagosFilas,
    ultimoMovimiento,
    movimientosCount,
    pagosChequePendientes,
    ventasPorArchivo,
    ventasPagadasPorArchivo,
    ventasPendientes,
    ultimoPago,
    ventasLiquidadas,
  ] = await Promise.all([
    prisma.cliente.findFirst({
      where: { id: clienteId },
      include: {
        obras: { orderBy: { nombre: "asc" } },
        archivos: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            obra: { select: { id: true, nombre: true } },
            movimientos: {
              select: { id: true, liquidadoAt: true, comprobante: true },
              where: { tipo: "venta" },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.movimiento.groupBy({
      by: ["obraId"],
      where: { clienteId, tipo: "venta" },
      _sum: { saldoPendiente: true },
    }),
    prisma.movimiento.groupBy({
      by: ["obraId", "tipo"],
      where: { clienteId, tipo: { notIn: ["venta", "pago"] } },
      _sum: { total: true },
    }),
    cargarAnticiposEnPagos({ clienteId }),
    prisma.movimiento.findFirst({
      where: { clienteId },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      select: { fecha: true, descripcion: true, tipo: true },
    }),
    prisma.movimiento.count({ where: { clienteId } }),
    prisma.movimiento.aggregate({
      where: {
        clienteId,
        tipo: "pago",
        medioPago: "cheque",
        OR: [
          { chequeVencimiento: { gt: new Date() } },
          { chequeVencimiento: null },
        ],
      },
      _sum: { total: true },
    }),
    prisma.movimiento.groupBy({
      by: ["archivoId"],
      where: { clienteId, tipo: "venta", archivoId: { not: null } },
      _count: { _all: true },
    }),
    prisma.movimiento.groupBy({
      by: ["archivoId"],
      where: { clienteId, tipo: "venta", archivoId: { not: null }, liquidadoAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.movimiento.findMany({
      where: { clienteId, ...filtroVentaImpaga },
      select: { fecha: true, saldoPendiente: true },
      take: 5000,
      orderBy: { fecha: "asc" },
    }),
    prisma.movimiento.findFirst({
      where: { clienteId, tipo: "pago" },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      select: { fecha: true, total: true, medioPago: true },
    }),
    prisma.movimiento.findMany({
      where: { clienteId, tipo: "venta", liquidadoAt: { not: null } },
      select: { fecha: true, liquidadoAt: true },
      take: 5000,
      orderBy: { fecha: "asc" },
    }),
  ]);

  if (!cliente) return null;

  const saldoPorTipo: Record<string, number> = {};
  const saldoSinObraPorTipo: Record<string, number> = {};
  const saldoPorObraId = new Map<string, Record<string, number>>();

  for (const g of ventaObraAgg) {
    const sum = Number(g._sum.saldoPendiente ?? 0);
    saldoPorTipo.venta = (saldoPorTipo.venta ?? 0) + sum;
    if (g.obraId === null) {
      saldoSinObraPorTipo.venta = (saldoSinObraPorTipo.venta ?? 0) + sum;
    } else {
      const prev = saldoPorObraId.get(g.obraId) ?? {};
      prev.venta = (prev.venta ?? 0) + sum;
      saldoPorObraId.set(g.obraId, prev);
    }
  }
  for (const g of otroObraAgg) {
    const sum = Number(g._sum.total ?? 0);
    saldoPorTipo[g.tipo] = (saldoPorTipo[g.tipo] ?? 0) + sum;
    if (g.obraId === null) {
      saldoSinObraPorTipo[g.tipo] = (saldoSinObraPorTipo[g.tipo] ?? 0) + sum;
    } else {
      const prev = saldoPorObraId.get(g.obraId) ?? {};
      prev[g.tipo] = (prev[g.tipo] ?? 0) + sum;
      saldoPorObraId.set(g.obraId, prev);
    }
  }
  for (const ap of anticipoPagosFilas) {
    const sum = ap.anticipo;
    saldoPorTipo.pago = (saldoPorTipo.pago ?? 0) + sum;
    if (ap.obraId === null) {
      saldoSinObraPorTipo.pago = (saldoSinObraPorTipo.pago ?? 0) + sum;
    } else {
      const prev = saldoPorObraId.get(ap.obraId) ?? {};
      prev.pago = (prev.pago ?? 0) + sum;
      saldoPorObraId.set(ap.obraId, prev);
    }
  }

  const obrasConSaldo = cliente.obras.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    saldo: saldoDesdeTotalesPorTipo(saldoPorObraId.get(o.id) ?? {}),
  }));

  const saldo = saldoDesdeTotalesPorTipo(saldoPorTipo);
  const totalChequesPendientes = Number(pagosChequePendientes._sum.total ?? 0);

  const hoy = new Date();
  const fechaUltVentaImpaga =
    ventasPendientes.length > 0 ? ventasPendientes[ventasPendientes.length - 1]!.fecha : null;
  const diasDesdeUltVentaImpaga = fechaUltVentaImpaga ? diasEntre(hoy, fechaUltVentaImpaga) : null;
  const estadoCobranza = estadoCobranzaDesdeSaldoYDias(saldo, diasDesdeUltVentaImpaga);
  const buckets = { corriente: 0, dias30a60: 0, dias60a90: 0, masde90: 0 };
  for (const v of ventasPendientes) {
    const pendNum = Number(v.saldoPendiente ?? 0);
    const dias = diasEntre(hoy, v.fecha);
    if (dias < 30) buckets.corriente += pendNum;
    else if (dias < 60) buckets.dias30a60 += pendNum;
    else if (dias < 90) buckets.dias60a90 += pendNum;
    else buckets.masde90 += pendNum;
  }

  let promedioDiasPago: number | null = null;
  if (ventasLiquidadas.length > 0) {
    const dias = ventasLiquidadas
      .map((v) => {
        const fin = v.liquidadoAt ?? null;
        if (!fin) return null;
        const diff = Math.floor((fin.getTime() - v.fecha.getTime()) / (1000 * 60 * 60 * 24));
        return Number.isFinite(diff) && diff >= 0 ? diff : null;
      })
      .filter((x): x is number => typeof x === "number");
    if (dias.length) {
      promedioDiasPago = Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10;
    }
  }

  const ventasCountByArchivoId = new Map<string, number>();
  for (const g of ventasPorArchivo) {
    if (!g.archivoId) continue;
    ventasCountByArchivoId.set(g.archivoId, g._count._all);
  }
  const ventasPagadasByArchivoId = new Map<string, number>();
  for (const g of ventasPagadasPorArchivo) {
    if (!g.archivoId) continue;
    ventasPagadasByArchivoId.set(g.archivoId, g._count._all);
  }

  return {
    ...cliente,
    archivos: cliente.archivos.map((a) => ({
      ...a,
      ventasCount: ventasCountByArchivoId.get(a.id) ?? 0,
      ventasPagadas: ventasPagadasByArchivoId.get(a.id) ?? 0,
      comprobante: a.comprobante ?? a.movimientos?.[0]?.comprobante ?? null,
    })),
    saldo,
    estadoCobranza,
    saldoEfectivo: saldoEfectivoConCheques({
      totalesPorTipo: saldoPorTipo,
      totalPagosChequePendientes: totalChequesPendientes,
    }),
    totalChequesPendientes,
    saldoSinObra: saldoDesdeTotalesPorTipo(saldoSinObraPorTipo),
    movimientosCount,
    obrasConSaldo,
    ultimoMovimiento,
    antiguedadDeuda: buckets,
    ultimoPago,
    promedioDiasPago,
  };
}

export type CrearClienteInput = {
  nombre: string;
  tipo: string;
  nombrePersona?: string | null;
  apellido?: string | null;
  cuit?: string | null;
  email?: string | null;
  telefono?: string | null;
};

const HISTORIAL_PAGOS_LIMIT = 300;

export type ClientePagoHistorialItem = {
  id: string;
  fecha: Date;
  total: number;
  medioPago: string | null;
  comprobante: string | null;
  descripcion: string;
  obra: { id: string; nombre: string } | null;
  imputadoAVentas: number;
  anticipo: number;
  /** Cobro conservado aunque se borró el PDF; no cuenta como anticipo en saldo. */
  excluirDeAnticipoCartera: boolean;
};

/** Movimientos `pago` del cliente (más recientes primero), con imputación a ventas vs anticipo. */
export async function listarHistorialPagosCliente(clienteId: string): Promise<ClientePagoHistorialItem[]> {
  const rows = await prisma.movimiento.findMany({
    where: { clienteId, tipo: "pago" },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: HISTORIAL_PAGOS_LIMIT,
    select: {
      id: true,
      fecha: true,
      total: true,
      medioPago: true,
      comprobante: true,
      descripcion: true,
      excluirDeAnticipoCartera: true,
      obra: { select: { id: true, nombre: true } },
    },
  });
  if (rows.length === 0) return [];

  const imputacion = await mapImputacionAnticipoPorPagoIds(rows.map((r) => r.id));

  return rows.map((r) => {
    const imp = imputacion.get(r.id);
    return {
      id: r.id,
      fecha: r.fecha,
      total: Number(r.total),
      medioPago: r.medioPago as string | null,
      comprobante: r.comprobante,
      descripcion: r.descripcion,
      obra: r.obra,
      imputadoAVentas: imp?.imputado ?? 0,
      anticipo: imp?.anticipo ?? 0,
      excluirDeAnticipoCartera: Boolean(r.excluirDeAnticipoCartera),
    };
  });
}

const LISTA_DEVOLUCIONES_LIMIT = 200;

export type ClienteDevolucionItem = {
  id: string;
  fecha: Date;
  total: number;
  comprobante: string | null;
  descripcion: string;
  obra: { id: string; nombre: string } | null;
};

export async function listarDevolucionesCliente(clienteId: string): Promise<ClienteDevolucionItem[]> {
  const rows = await prisma.movimiento.findMany({
    where: { clienteId, tipo: "devolucion" },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: LISTA_DEVOLUCIONES_LIMIT,
    select: {
      id: true,
      fecha: true,
      total: true,
      comprobante: true,
      descripcion: true,
      obra: { select: { id: true, nombre: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    fecha: r.fecha,
    total: Number(r.total),
    comprobante: r.comprobante,
    descripcion: r.descripcion,
    obra: r.obra,
  }));
}

export async function crearCliente(input: CrearClienteInput) {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("Nombre requerido");
  if (!esTipoCliente(input.tipo)) throw new Error('Tipo debe ser "particular" o "constructor"');

  return prisma.cliente.create({
    data: {
      nombre,
      tipo: input.tipo as TipoCliente,
      nombrePersona: trimOrNull(input.nombrePersona),
      apellido: trimOrNull(input.apellido),
      cuit: trimOrNull(input.cuit),
      email: trimOrNull(input.email),
      telefono: trimOrNull(input.telefono),
    },
  });
}

export type ActualizarClienteInput = {
  nombre?: string;
  tipo?: string;
  nombrePersona?: string | null;
  apellido?: string | null;
  cuit?: string | null;
  email?: string | null;
  telefono?: string | null;
  estadoGestionCuenta?: EstadoGestionCuenta;
};

/** Lectura de cliente por id vía SQL: incluye `estadoGestionCuenta` aunque el client Prisma en runtime esté viejo. */
async function clienteFilaPorId(clienteId: string) {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      nombre: string;
      tipo: string;
      nombrePersona: string | null;
      apellido: string | null;
      cuit: string | null;
      email: string | null;
      telefono: string | null;
      estadoGestionCuenta: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[]
  >`
    SELECT id, nombre, tipo, "nombrePersona", apellido, cuit, email, telefono, "estadoGestionCuenta", "createdAt", "updatedAt"
    FROM "Cliente"
    WHERE id = ${clienteId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const eg =
    row.estadoGestionCuenta != null && esEstadoGestionCuenta(row.estadoGestionCuenta)
      ? row.estadoGestionCuenta
      : ("FALTA_PAGO" satisfies EstadoGestionCuenta);
  return {
    ...row,
    tipo: row.tipo as TipoCliente,
    estadoGestionCuenta: eg,
  };
}

export async function actualizarCliente(
  clienteId: string,
  input: ActualizarClienteInput,
) {
  const existe = await prisma.cliente.findFirst({
    where: { id: clienteId },
    select: { id: true },
  });
  if (!existe) return null;

  if (input.tipo !== undefined && !esTipoCliente(input.tipo)) {
    throw new Error('Tipo debe ser "particular" o "constructor"');
  }
  if (input.nombre !== undefined && !input.nombre.trim()) {
    throw new Error("Nombre requerido");
  }

  const data: Prisma.ClienteUpdateInput = {};
  if (input.nombre !== undefined) data.nombre = input.nombre.trim();
  if (input.tipo !== undefined) data.tipo = input.tipo as TipoCliente;
  if (input.nombrePersona !== undefined) data.nombrePersona = trimOrNull(input.nombrePersona);
  if (input.apellido !== undefined) data.apellido = trimOrNull(input.apellido);
  if (input.cuit !== undefined) data.cuit = trimOrNull(input.cuit);
  if (input.email !== undefined) data.email = trimOrNull(input.email);
  if (input.telefono !== undefined) data.telefono = trimOrNull(input.telefono);

  const tieneEstado = input.estadoGestionCuenta !== undefined;
  if (tieneEstado) {
    if (!esEstadoGestionCuenta(input.estadoGestionCuenta!)) {
      throw new Error("Estado de gestión inválido");
    }
    await prisma.$executeRaw`
      UPDATE "Cliente"
      SET "estadoGestionCuenta" = ${input.estadoGestionCuenta}::"EstadoGestionCuenta"
      WHERE id = ${clienteId}
    `;
  }

  if (Object.keys(data).length > 0) {
    await prisma.cliente.update({
      where: { id: clienteId },
      data,
    });
  }

  if (!tieneEstado && Object.keys(data).length === 0) {
    return clienteFilaPorId(clienteId);
  }

  return clienteFilaPorId(clienteId);
}

export async function eliminarCliente(clienteId: string) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId },
    include: {
      obras: true,
      movimientos: true,
      archivos: true,
    },
  });
  if (!cliente) return false;

  await auditLogEliminacion({
    entidad: "cliente",
    entidadId: clienteId,
    snapshot: cliente,
  });

  await prisma.cliente.delete({ where: { id: clienteId } });

  await Promise.allSettled(cliente.archivos.map((a) => tryRemoveStoredFile(a.url)));
  return true;
}
