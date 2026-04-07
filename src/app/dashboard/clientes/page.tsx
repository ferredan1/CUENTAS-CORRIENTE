import type { ClienteTablaRow } from "@/components/clientes/ClientesTable";
import { DashboardPrimaryActions } from "@/components/dashboard/DashboardPrimaryActions";
import { getServerUserId } from "@/lib/get-server-user-id";
import {
  listarClientesParaTabla,
  parseFiltroClientesTabla,
  parseOrdenClientesTabla,
} from "@/services/clientes";
import { NuevoClienteForm } from "../NuevoClienteForm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardClientesClient } from "../DashboardClientesClient";

function toTablaRow(
  c: Awaited<ReturnType<typeof listarClientesParaTabla>>["clientes"][number],
): ClienteTablaRow {
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    cuit: c.cuit ?? null,
    telefono: c.telefono ?? null,
    saldo: c.saldo,
    deudaMas90: c.deudaMas90,
    estadoCobranza: c.estadoCobranza,
    estadoGestionCuenta: c.estadoGestionCuenta,
    obrasEstado: c.obrasEstado,
    diasSinPagar: c.diasSinPagar,
    saldoVencido60: c.saldoVencido60,
    ultimoMovimientoFecha: c.ultimoMovimientoFecha?.toISOString() ?? null,
    obrasCount: c.obrasCount,
  };
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string; orderBy?: string }>;
}) {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");

  const sp = await searchParams;
  const filtro = parseFiltroClientesTabla(sp.filtro);
  const orderBy = parseOrdenClientesTabla(sp.orderBy);
  const { clientes, nextCursor } = await listarClientesParaTabla({
    busqueda: sp.q?.trim() || undefined,
    filtro,
    orderBy,
    limit: 50,
    cursor: null,
  });

  return (
    <div className="page-shell space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle-quiet max-w-xl">
            Filtros rápidos, columnas de cobranza y scroll infinito. Orden y filtro se aplican en el servidor.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DashboardPrimaryActions includeNuevoCliente={false} />
          <Link href="/api/clientes/export" className="btn-secondary">
            Exportar Excel
          </Link>
        </div>
      </header>

      <section id="alta-rapida-cliente">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Alta rápida</h2>
        <div className="mt-2">
          <NuevoClienteForm variant="compact" />
        </div>
      </section>

      <DashboardClientesClient
        initialQ={sp.q?.trim() ?? ""}
        initialFiltro={filtro}
        initialOrderBy={orderBy}
        initialClientes={clientes.map(toTablaRow)}
        initialNextCursor={nextCursor}
        showCargarPagoButton={false}
      />
    </div>
  );
}
