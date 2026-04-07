import { normalizarComprobanteParaDuplicado } from "@/domain/comprobantes/normalize";
import { toDecimal2 } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import { auditLogCambio, auditLogEliminacion } from "@/services/audit";

const T_COMPRA = "compra" as const;
const T_PAGO = "pago" as const;
const T_AJUSTE = "ajuste" as const;
const TIPOS = [T_COMPRA, T_PAGO, T_AJUSTE] as const;

/** Compras marcadas con `liquidadoAt` no deben seguir computando deuda. */
function whereSaldoPendienteProveedor(
  extra?: Omit<Parameters<typeof prisma.movimientoProveedor.groupBy>[0]["where"], "OR">,
) {
  return {
    ...(extra ?? {}),
    OR: [{ tipo: { not: T_COMPRA } }, { tipo: T_COMPRA, liquidadoAt: null }],
  } as const;
}

function trimOrNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

export function saldoProveedorDesdeTotales(totales: Record<string, number>): number {
  const compras = (totales[T_COMPRA] ?? 0) + (totales[T_AJUSTE] ?? 0);
  const pagos = totales[T_PAGO] ?? 0;
  return compras - pagos;
}

function inicioDiaLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Próximo vencimiento futuro; si no hay, el vencimiento vencido más antiguo (más urgente). */
function vencimientoReferenciaDesdeFechas(fechas: Date[], ahora = new Date()): Date | null {
  if (fechas.length === 0) return null;
  const h0 = inicioDiaLocal(ahora).getTime();
  const normalizadas = fechas.map((f) => ({ t: inicioDiaLocal(f).getTime(), d: f }));
  const futuros = normalizadas.filter((x) => x.t >= h0);
  if (futuros.length) {
    const minT = Math.min(...futuros.map((x) => x.t));
    return new Date(minT);
  }
  const pasados = normalizadas.filter((x) => x.t < h0);
  if (pasados.length) {
    const minT = Math.min(...pasados.map((x) => x.t));
    return new Date(minT);
  }
  return fechas[0] ?? null;
}

export async function listarProveedoresConSaldo(busqueda?: string) {
  const q = busqueda?.trim();
  const proveedores = await prisma.proveedor.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" } },
              { razonSocial: { contains: q, mode: "insensitive" } },
              { cuit: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { nombre: "asc" },
    take: 2000,
  });

  if (proveedores.length === 0) return [];

  const ids = proveedores.map((p) => p.id);
  const grouped = await prisma.movimientoProveedor.groupBy({
    by: ["proveedorId", "tipo"],
    where: whereSaldoPendienteProveedor({ proveedorId: { in: ids } }),
    _sum: { total: true },
  });

  const porProveedor = new Map<string, Record<string, number>>();
  for (const g of grouped) {
    const prev = porProveedor.get(g.proveedorId) ?? {};
    prev[g.tipo] = Number(g._sum.total ?? 0);
    porProveedor.set(g.proveedorId, prev);
  }

  const [ultimos, vencRows] = await Promise.all([
    prisma.movimientoProveedor.groupBy({
      by: ["proveedorId"],
      where: { proveedorId: { in: ids } },
      _max: { fecha: true },
    }),
    prisma.movimientoProveedor.findMany({
      where: { proveedorId: { in: ids }, fechaVencimiento: { not: null } },
      select: { proveedorId: true, fechaVencimiento: true },
    }),
  ]);

  const ultimoMap = new Map<string, Date | null>(
    ultimos.map((u) => [u.proveedorId, u._max.fecha]),
  );
  const fechasVencPorProv = new Map<string, Date[]>();
  for (const r of vencRows) {
    if (!r.fechaVencimiento) continue;
    const arr = fechasVencPorProv.get(r.proveedorId) ?? [];
    arr.push(r.fechaVencimiento);
    fechasVencPorProv.set(r.proveedorId, arr);
  }
  const vencRefMap = new Map<string, Date | null>();
  for (const [pid, fs] of fechasVencPorProv) {
    vencRefMap.set(pid, vencimientoReferenciaDesdeFechas(fs));
  }

  return proveedores.map((p) => ({
    ...p,
    saldo: saldoProveedorDesdeTotales(porProveedor.get(p.id) ?? {}),
    ultimoMovimientoFecha: ultimoMap.get(p.id) ?? null,
    vencimientoReferencia: vencRefMap.get(p.id) ?? null,
  }));
}

/** Compras con vencimiento (para banner en cliente con TZ local). */
export async function contarProveedores() {
  return prisma.proveedor.count();
}

export async function listarComprasProveedorConVencimiento() {
  return prisma.movimientoProveedor.findMany({
    where: {
      tipo: T_COMPRA,
      fechaVencimiento: { not: null },
    },
    select: { total: true, fechaVencimiento: true },
    orderBy: { fechaVencimiento: "asc" },
    take: 3000,
  });
}

export async function listarTopProveedoresConDeuda(limit = 5) {
  const todos = await listarProveedoresConSaldo();
  return todos
    .filter((p) => p.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, Math.max(1, limit))
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      saldo: p.saldo,
      ultimoMovimientoFecha: p.ultimoMovimientoFecha,
      vencimientoReferencia: p.vencimientoReferencia,
    }));
}

export async function resumirProveedores(): Promise<{
  totalAPagar: number;
  proveedoresConDeuda: number;
}> {
  const grouped = await prisma.movimientoProveedor.groupBy({
    by: ["proveedorId", "tipo"],
    where: whereSaldoPendienteProveedor(),
    _sum: { total: true },
  });
  if (grouped.length === 0) return { totalAPagar: 0, proveedoresConDeuda: 0 };

  const porProveedor = new Map<string, Record<string, number>>();
  for (const g of grouped) {
    const prev = porProveedor.get(g.proveedorId) ?? {};
    prev[g.tipo] = Number(g._sum.total ?? 0);
    porProveedor.set(g.proveedorId, prev);
  }

  let totalAPagar = 0;
  let proveedoresConDeuda = 0;
  for (const [, totales] of porProveedor) {
    const saldo = saldoProveedorDesdeTotales(totales);
    if (saldo > 0) {
      proveedoresConDeuda += 1;
      totalAPagar += saldo;
    }
  }

  return { totalAPagar, proveedoresConDeuda };
}

export async function obtenerProveedor(proveedorId: string) {
  const [proveedor, grouped, ultimoMovimiento, movimientosCount] = await Promise.all([
    prisma.proveedor.findFirst({
      where: { id: proveedorId },
      include: {
        archivos: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    }),
    prisma.movimientoProveedor.groupBy({
      by: ["tipo"],
      where: whereSaldoPendienteProveedor({ proveedorId }),
      _sum: { total: true },
    }),
    prisma.movimientoProveedor.findFirst({
      where: { proveedorId },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      select: { fecha: true, descripcion: true, tipo: true },
    }),
    prisma.movimientoProveedor.count({ where: { proveedorId } }),
  ]);

  if (!proveedor) return null;

  const totales: Record<string, number> = {};
  for (const g of grouped) {
    totales[g.tipo] = Number(g._sum.total ?? 0);
  }

  return {
    ...proveedor,
    saldo: saldoProveedorDesdeTotales(totales),
    movimientosCount,
    ultimoMovimiento,
  };
}

export async function crearProveedor(input: {
  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  email?: string | null;
  telefono?: string | null;
  condicionIva?: string | null;
  notas?: string | null;
}) {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("Nombre requerido");
  return prisma.proveedor.create({
    data: {
      nombre,
      razonSocial: trimOrNull(input.razonSocial),
      cuit: trimOrNull(input.cuit),
      email: trimOrNull(input.email),
      telefono: trimOrNull(input.telefono),
      condicionIva: trimOrNull(input.condicionIva),
      notas: trimOrNull(input.notas),
    },
  });
}

export async function actualizarProveedor(
  proveedorId: string,
  input: {
    nombre?: string;
    razonSocial?: string | null;
    cuit?: string | null;
    email?: string | null;
    telefono?: string | null;
    condicionIva?: string | null;
    notas?: string | null;
  },
) {
  const existe = await prisma.proveedor.findFirst({
    where: { id: proveedorId },
    select: { id: true },
  });
  if (!existe) return null;

  if (input.nombre !== undefined && !input.nombre.trim()) throw new Error("Nombre requerido");

  return prisma.proveedor.update({
    where: { id: proveedorId },
    data: {
      ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
      ...(input.razonSocial !== undefined ? { razonSocial: trimOrNull(input.razonSocial) } : {}),
      ...(input.cuit !== undefined ? { cuit: trimOrNull(input.cuit) } : {}),
      ...(input.email !== undefined ? { email: trimOrNull(input.email) } : {}),
      ...(input.telefono !== undefined ? { telefono: trimOrNull(input.telefono) } : {}),
      ...(input.condicionIva !== undefined ? { condicionIva: trimOrNull(input.condicionIva) } : {}),
      ...(input.notas !== undefined ? { notas: trimOrNull(input.notas) } : {}),
    },
  });
}

export async function eliminarProveedor(proveedorId: string) {
  const p = await prisma.proveedor.findFirst({
    where: { id: proveedorId },
    include: {
      movimientos: true,
      archivos: true,
    },
  });
  if (!p) return false;
  await auditLogEliminacion({ entidad: "proveedor", entidadId: proveedorId, snapshot: p });
  await prisma.proveedor.delete({ where: { id: proveedorId } });
  return true;
}

export async function crearMovimientoProveedor(input: {
  proveedorId: string;
  tipo: string;
  fecha: Date;
  comprobante?: string | null;
  codigoProducto?: string | null;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  archivoId?: string | null;
  fechaVencimiento?: Date | null;
  notas?: string | null;
}) {
  if (!TIPOS.includes(input.tipo as (typeof TIPOS)[number])) throw new Error("Tipo inválido");

  const p = await prisma.proveedor.findFirst({
    where: { id: input.proveedorId },
    select: { id: true },
  });
  if (!p) throw new Error("Proveedor no encontrado");

  const cantidad = Number(input.cantidad);
  const precioUnitario = Number(input.precioUnitario);
  if (!Number.isFinite(cantidad) || !Number.isFinite(precioUnitario)) throw new Error("Importes inválidos");
  const total = Math.round(cantidad * precioUnitario * 100) / 100;

  const compTrim = trimOrNull(input.comprobante);
  const normKey = compTrim ? normalizarComprobanteParaDuplicado(compTrim) : "";
  const normalizedComprobante = normKey.length >= 2 ? normKey : null;

  if (input.tipo === T_COMPRA && normalizedComprobante) {
    const dup = await prisma.movimientoProveedor.findFirst({
      where: { proveedorId: input.proveedorId, tipo: T_COMPRA, normalizedComprobante },
      select: { comprobante: true },
    });
    if (dup) throw new Error(`Ya existe una compra con el comprobante «${dup.comprobante ?? compTrim}».`);
  }

  const fechaVencimiento =
    input.tipo === T_COMPRA ? (input.fechaVencimiento !== undefined ? input.fechaVencimiento : null) : null;

  const created = await prisma.movimientoProveedor.create({
    data: {
      proveedorId: input.proveedorId,
      tipo: input.tipo as (typeof TIPOS)[number],
      fecha: input.fecha,
      comprobante: compTrim,
      normalizedComprobante,
      codigoProducto: trimOrNull(input.codigoProducto),
      descripcion: input.descripcion.trim(),
      cantidad,
      precioUnitario: toDecimal2(precioUnitario),
      total: toDecimal2(total),
      archivoId: input.archivoId ?? null,
      fechaVencimiento,
      ...(input.notas !== undefined ? { notas: trimOrNull(input.notas) } : {}),
    },
  });

  if (input.tipo === T_PAGO && compTrim) {
    await prisma.movimientoProveedor
      .updateMany({
        where: {
          proveedorId: input.proveedorId,
          tipo: T_COMPRA,
          liquidadoAt: null,
          OR: [
            ...(normalizedComprobante ? [{ normalizedComprobante }] : []),
            { comprobante: compTrim },
          ],
        },
        data: { liquidadoAt: new Date(), liquidadoPorPagoId: created.id },
      })
      .catch((e) => {
        console.error("[liquidacion-proveedor] Error:", e);
      });
  }

  return created;
}

export async function listarMovimientosProveedor(
  proveedorId: string,
  opts?: { desde?: Date; hasta?: Date; tipo?: string; limit?: number },
) {
  const take = Math.min(Math.max(opts?.limit ?? 2000, 1), 5000);
  return prisma.movimientoProveedor.findMany({
    where: {
      proveedorId,
      ...(opts?.tipo ? { tipo: opts.tipo as (typeof TIPOS)[number] } : {}),
      ...(opts?.desde || opts?.hasta
        ? {
            fecha: {
              ...(opts.desde ? { gte: opts.desde } : {}),
              ...(opts.hasta ? { lte: opts.hasta } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
    take,
  });
}

export async function actualizarMovimientoProveedor(
  movId: string,
  patch: Partial<{
    fecha: Date;
    descripcion: string;
    comprobante: string | null;
    cantidad: number;
    precioUnitario: number;
    tipo: string;
    liquidadoAt: Date | null;
    fechaVencimiento: Date | null;
    notas: string | null;
  }>,
) {
  const existente = await prisma.movimientoProveedor.findFirst({
    where: { id: movId },
  });
  if (!existente) return null;

  const tipoFinal = patch.tipo !== undefined ? patch.tipo : existente.tipo;
  if (patch.tipo !== undefined && !TIPOS.includes(patch.tipo as (typeof TIPOS)[number])) {
    throw new Error("Tipo inválido");
  }
  if (tipoFinal === T_COMPRA && existente.liquidadoAt && patch.liquidadoAt === null) {
    // permitir “desliquidar” explícitamente si se manda null; no bloqueamos por default
  }

  const cantidad = patch.cantidad !== undefined ? Number(patch.cantidad) : existente.cantidad;
  const precioUnitario =
    patch.precioUnitario !== undefined ? Number(patch.precioUnitario) : Number(existente.precioUnitario);
  const total = Math.round(cantidad * precioUnitario * 100) / 100;

  const compStr = patch.comprobante !== undefined ? trimOrNull(patch.comprobante) : existente.comprobante;
  const normKey = compStr ? normalizarComprobanteParaDuplicado(compStr) : "";
  const normalizedComprobante =
    patch.comprobante !== undefined ? (normKey.length >= 2 ? normKey : null) : existente.normalizedComprobante;

  const fechaVencimientoNext =
    patch.fechaVencimiento !== undefined
      ? tipoFinal === T_COMPRA
        ? patch.fechaVencimiento
        : null
      : undefined;

  const notasFinal =
    patch.notas === undefined
      ? (existente.notas ?? null)
      : patch.notas === null || typeof patch.notas !== "string" || patch.notas.trim() === ""
        ? null
        : patch.notas.trim();

  const fechaFinal = patch.fecha ?? existente.fecha;
  const descripcionFinal = patch.descripcion !== undefined ? patch.descripcion.trim() : existente.descripcion;
  const liquidadoAtFinal = patch.liquidadoAt !== undefined ? patch.liquidadoAt : existente.liquidadoAt;
  const tipoFinal2 = (patch.tipo !== undefined ? (patch.tipo as (typeof TIPOS)[number]) : existente.tipo) as string;
  const fechaVencFinal =
    fechaVencimientoNext !== undefined ? fechaVencimientoNext : (existente.fechaVencimiento ?? null);

  const cambios: Array<{ campo: string; valorAntes: unknown; valorDespues: unknown }> = [];
  if (fechaFinal.getTime() !== existente.fecha.getTime()) cambios.push({ campo: "fecha", valorAntes: existente.fecha, valorDespues: fechaFinal });
  if (existente.descripcion !== descripcionFinal) cambios.push({ campo: "descripcion", valorAntes: existente.descripcion, valorDespues: descripcionFinal });
  if ((existente.comprobante ?? null) !== (compStr ?? null)) cambios.push({ campo: "comprobante", valorAntes: existente.comprobante ?? null, valorDespues: compStr ?? null });
  if (Number(existente.cantidad) !== cantidad) cambios.push({ campo: "cantidad", valorAntes: existente.cantidad, valorDespues: cantidad });
  if (Number(existente.precioUnitario) !== precioUnitario) cambios.push({ campo: "precioUnitario", valorAntes: Number(existente.precioUnitario), valorDespues: precioUnitario });
  if (existente.tipo !== (tipoFinal2 as never)) cambios.push({ campo: "tipo", valorAntes: existente.tipo, valorDespues: tipoFinal2 });
  if ((existente.liquidadoAt ?? null)?.getTime?.() !== (liquidadoAtFinal ?? null)?.getTime?.()) cambios.push({ campo: "liquidadoAt", valorAntes: existente.liquidadoAt ?? null, valorDespues: liquidadoAtFinal ?? null });
  if ((existente.fechaVencimiento ?? null)?.getTime?.() !== (fechaVencFinal ?? null)?.getTime?.()) cambios.push({ campo: "fechaVencimiento", valorAntes: existente.fechaVencimiento ?? null, valorDespues: fechaVencFinal ?? null });
  if ((existente.notas ?? null) !== (notasFinal ?? null)) cambios.push({ campo: "notas", valorAntes: existente.notas ?? null, valorDespues: notasFinal ?? null });

  const updated = await prisma.movimientoProveedor.update({
    where: { id: movId },
    data: {
      fecha: fechaFinal,
      descripcion: descripcionFinal,
      fechaVencimiento: fechaVencFinal,
      notas: notasFinal,
      comprobante: compStr,
      normalizedComprobante,
      tipo: tipoFinal2 as (typeof TIPOS)[number],
      liquidadoAt: liquidadoAtFinal,
      cantidad,
      precioUnitario: toDecimal2(precioUnitario),
      total: toDecimal2(total),
    },
  });

  await auditLogCambio({ entidad: "movimiento_proveedor", entidadId: movId, cambios });

  return updated;
}

export async function eliminarMovimientoProveedor(movId: string) {
  const r = await prisma.movimientoProveedor.deleteMany({ where: { id: movId } });
  return r.count > 0;
}
