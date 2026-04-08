import { toIsoUtc } from "@/lib/format";
import { getServerUserId } from "@/lib/get-server-user-id";
import { obtenerCliente } from "@/services/clientes";
import { notFound, redirect } from "next/navigation";
import { ClienteFichaClient, type ClienteFichaDTO } from "./ClienteFichaClient";

type Props = { params: Promise<{ id: string }> };

export default async function ClienteDetallePage({ params }: Props) {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const cliente = await obtenerCliente(id);
  if (!cliente) notFound();

  const dto: ClienteFichaDTO = {
    id: cliente.id,
    nombre: cliente.nombre,
    tipo: cliente.tipo,
    nombrePersona: cliente.nombrePersona,
    apellido: cliente.apellido,
    cuit: cliente.cuit,
    email: cliente.email,
    telefono: cliente.telefono,
    saldo: cliente.saldo,
    estadoCobranza:
      (cliente as { estadoCobranza?: ClienteFichaDTO["estadoCobranza"] }).estadoCobranza ??
      (cliente.saldo > 0 ? "moroso" : "al_dia"),
    saldoEfectivo: cliente.saldoEfectivo ?? cliente.saldo,
    totalChequesPendientes: cliente.totalChequesPendientes ?? 0,
    saldoSinObra: cliente.saldoSinObra,
    movimientosCount: cliente.movimientosCount,
    updatedAt: toIsoUtc(cliente.updatedAt, cliente.createdAt),
    archivos: cliente.archivos.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      createdAt: toIsoUtc(a.createdAt),
      obra: a.obra ? { id: a.obra.id, nombre: a.obra.nombre } : null,
      comprobante: (a as { comprobante?: string | null }).comprobante ?? null,
      ventasCount: (a as { ventasCount?: number }).ventasCount ?? 0,
      ventasPagadas: (a as { ventasPagadas?: number }).ventasPagadas ?? 0,
    })),
    obrasConSaldo: cliente.obrasConSaldo.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      saldo: o.saldo,
      estadoSaldo:
        "estadoSaldo" in o && o.estadoSaldo != null
          ? (o.estadoSaldo as ClienteFichaDTO["obrasConSaldo"][number]["estadoSaldo"])
          : "sin_facturar",
    })),
    ultimoMovimiento: cliente.ultimoMovimiento
      ? {
          fecha: toIsoUtc(cliente.ultimoMovimiento.fecha),
          descripcion: cliente.ultimoMovimiento.descripcion,
          tipo: cliente.ultimoMovimiento.tipo,
        }
      : null,
    antiguedadDeuda: cliente.antiguedadDeuda,
    ultimoPago: (cliente as { ultimoPago?: { fecha: Date; total: unknown; medioPago: string | null } | null })
      .ultimoPago
      ? {
          fecha: toIsoUtc((cliente as { ultimoPago: { fecha: Date } }).ultimoPago.fecha),
          total: Number((cliente as { ultimoPago: { total: unknown } }).ultimoPago.total ?? 0),
          medioPago: (cliente as { ultimoPago: { medioPago: string | null } }).ultimoPago.medioPago,
        }
      : null,
    promedioDiasPago: (cliente as { promedioDiasPago?: number | null }).promedioDiasPago ?? null,
  };

  return (
    <div className="page-shell">
      <ClienteFichaClient c={dto} />
    </div>
  );
}
