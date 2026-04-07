import { formatFechaCorta, formatFechaLargaHoy, formatMoneda } from "@/lib/format";
import { getServerUserId } from "@/lib/get-server-user-id";
import {
  contarPagosHoy,
  importeCobrosHoy,
  obtenerActividadReciente,
  totalSaldoVencidoMas60Dias,
} from "@/services/dashboard-metrics";
import { DashboardPanelTopBar } from "@/components/dashboard/DashboardPanelTopBar";
import { DashboardPrimaryActions } from "@/components/dashboard/DashboardPrimaryActions";
import { DashboardProveedoresPreview } from "@/components/dashboard/DashboardProveedoresPreview";
import { ChequesBannerServer } from "./ChequesBannerServer";
import { FacturasProveedorBannerServer } from "./FacturasProveedorBannerServer";
import { listarClientesParaTabla, resumenCarteraPanel } from "@/services/clientes";
import {
  contarProveedores,
  listarTopProveedoresConDeuda,
  resumirProveedores,
} from "@/services/proveedores";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ClienteTablaRow } from "@/components/clientes/ClientesTable";
import { DashboardClientesClient } from "./DashboardClientesClient";

function embedRow(
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");

  const { q } = await searchParams;
  const [
    carteraKpis,
    paginaClientes,
    actividad,
    pagosHoy,
    importeCobrosDia,
    totalVencido60,
    proveedoresResumen,
    proveedoresCount,
    topProveedores,
  ] = await Promise.all([
    resumenCarteraPanel(),
    listarClientesParaTabla({
      busqueda: q?.trim() || undefined,
      filtro: "todos",
      orderBy: "nombre",
      limit: 80,
      cursor: null,
    }),
    obtenerActividadReciente(),
    contarPagosHoy(),
    importeCobrosHoy(),
    totalSaldoVencidoMas60Dias(),
    resumirProveedores(),
    contarProveedores(),
    listarTopProveedoresConDeuda(5),
  ]);

  const totalCartera = carteraKpis.totalCartera;
  const morosos = carteraKpis.morosos;
  const posicionNeta = totalCartera - proveedoresResumen.totalAPagar;
  const panelVacio = carteraKpis.clientesCount === 0 && proveedoresCount === 0;

  const fechaHoy = formatFechaLargaHoy();

  return (
    <div className="page-shell space-y-6 md:space-y-8">
      <header className="space-y-5 border-b border-slate-200/80 pb-6 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="text-sm text-slate-500 dark:text-slate-400" aria-label="Migas de pan">
            <span className="font-medium text-slate-800 dark:text-slate-100">Panel</span>
            <span className="mx-2 text-slate-300 dark:text-slate-600">/</span>
            <span>Resumen operativo</span>
          </nav>
          <time className="text-sm tabular-nums text-slate-500 dark:text-slate-400" dateTime={new Date().toISOString()}>
            {fechaHoy}
          </time>
        </div>
        <DashboardPanelTopBar initialQ={q?.trim() ?? ""}>
          <DashboardPrimaryActions includeNuevoCliente={false} />
        </DashboardPanelTopBar>
      </header>

      {panelVacio ? (
        <div className="panel-empty-hint">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sin datos cargados aún</p>
          <p className="mt-1 text-xs text-slate-500">
            Creá un cliente o un proveedor para ver métricas. Podés empezar por acá:
          </p>
          <div className="toolbar-cluster mt-3">
            <Link href="/dashboard/clientes" className="btn-primary">
              Ir a clientes
            </Link>
            <Link href="/dashboard/proveedores" className="btn-secondary">
              Ir a proveedores
            </Link>
            <Link href="/dashboard/upload" className="btn-tertiary">
              Subir PDF
            </Link>
            <Link href="/dashboard/carga" className="btn-tertiary">
              Cargar pago
            </Link>
          </div>
        </div>
      ) : null}

      {!panelVacio ? (
        <section aria-labelledby="posicion-fin-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="posicion-fin-heading" className="ui-label-strong text-slate-500">
              Posición financiera
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
              <div className="border-l-[4px] border-emerald-600 pl-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Posición neta
                </p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${
                    posicionNeta >= 0 ? "text-slate-900 dark:text-slate-50" : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {formatMoneda(posicionNeta)}
                </p>
                <p className="mt-2 text-[0.7rem] leading-snug text-slate-500 dark:text-slate-400">
                  Cartera a cobrar (solo cuentas deudoras) menos lo que debés a proveedores. Los saldos a favor del
                  cliente no restan en este resumen: el «Saldo a cobrar» suma únicamente deudas; un anticipo o saldo a
                  favor no baja ese total ni la posición neta de la misma forma que un pago que cancela deuda.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] font-medium">
                  <Link href="/dashboard/clientes" className="text-emerald-700 hover:underline dark:text-emerald-400">
                    Ver clientes →
                  </Link>
                  <Link href="/dashboard/proveedores" className="text-emerald-700 hover:underline dark:text-emerald-400">
                    Ver proveedores →
                  </Link>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Saldo a cobrar</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  totalCartera > 0 ? "text-rose-700 dark:text-rose-300" : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {formatMoneda(totalCartera)}
              </p>
              <span
                className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                  morosos > 0 ? "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {morosos} {morosos === 1 ? "cliente" : "clientes"}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Vencido &gt; 60 días</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  totalVencido60 > 0 ? "text-amber-800 dark:text-amber-200" : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {formatMoneda(totalVencido60)}
              </p>
              <span
                className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                  totalVencido60 <= 0
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
                }`}
              >
                {totalVencido60 <= 0 ? "Al día" : "Revisar"}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/50">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Cobros</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  importeCobrosDia > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {formatMoneda(importeCobrosDia)}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {pagosHoy} {pagosHoy === 1 ? "pago" : "pagos"} imputados
              </span>
            </div>
            <Link
              href="/dashboard/proveedores"
              className={`rounded-xl border p-4 shadow-sm transition-colors ${
                proveedoresResumen.totalAPagar <= 0
                  ? "border-slate-200/90 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:bg-slate-900/80"
                  : "border-rose-200/80 bg-rose-50/40 hover:bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
              }`}
            >
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">A pagar proveedores</p>
              <p
                className={`mt-1 text-2xl font-bold tabular-nums ${
                  proveedoresResumen.totalAPagar <= 0
                    ? "text-slate-800 dark:text-slate-100"
                    : "text-rose-800 dark:text-rose-200"
                }`}
              >
                {formatMoneda(proveedoresResumen.totalAPagar)}
              </p>
              <span
                className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                  proveedoresResumen.totalAPagar <= 0
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                }`}
              >
                {proveedoresResumen.totalAPagar <= 0 ? "Sin deuda" : "Pendiente"}
              </span>
            </Link>
          </div>
        </section>
      ) : null}

      <div
        className={`border-t border-slate-200/90 pt-8 dark:border-slate-800 ${!panelVacio ? "mt-2" : ""}`}
      >
        {/*
          Misma fila del grid, mismo scroll de página que Clientes (sin sticky: el panel derecho no “flota” aparte).
        */}
        <div className="grid gap-6 overflow-visible lg:grid-cols-2 lg:items-start">
          <section className="min-h-0 min-w-0 rounded-xl border border-slate-200/90 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">Clientes</h2>
                <p className="mt-0.5 text-[0.7rem] text-slate-500">Vista previa · búsqueda y filtros</p>
              </div>
              <Link
                href="/dashboard/clientes"
                className="btn-secondary h-8 shrink-0 px-3 py-0 text-xs font-medium"
              >
                Ver todos →
              </Link>
            </div>
            <div className="p-4 sm:p-5">
              <DashboardClientesClient
                initialQ={q?.trim() ?? ""}
                initialFiltro="todos"
                initialOrderBy="nombre"
                initialClientes={paginaClientes.clientes.map(embedRow)}
                initialNextCursor={paginaClientes.nextCursor}
                showCargarPagoButton={false}
                hideSearchBar
                showEstadoCuentaColumn={false}
              />
            </div>
          </section>
          <DashboardProveedoresPreview proveedores={topProveedores} />
        </div>
      </div>

      {!panelVacio ? (
        <section
          aria-labelledby="alertas-heading"
          className="border-t border-slate-200/80 pt-8 dark:border-slate-800"
        >
          <div className="mb-4">
            <h2 id="alertas-heading" className="section-title">
              Alertas
            </h2>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              Se muestran solas cuando hay datos que las disparan (por ejemplo cheques próximos a vencer o facturas de
              proveedor con vencimiento cercano). No requieren configuración manual.
            </p>
          </div>
          <div className="space-y-3">
            <ChequesBannerServer />
            <FacturasProveedorBannerServer />
          </div>
        </section>
      ) : null}

      {!panelVacio ? (
        <section
          aria-labelledby="actividad-reciente-heading"
          className="border-t border-slate-200/80 pt-8 dark:border-slate-800"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 id="actividad-reciente-heading" className="section-title">
                Actividad reciente
              </h2>
              <p className="mt-1 text-xs text-slate-400">Seguimiento de lo último registrado</p>
            </div>
          </div>
          <div className="card-compact space-y-3 opacity-[0.97]">
            <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
              <li className="flex gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="w-9 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                  Mov.
                </span>
                <span>
                  {actividad.ultimoMovimiento ? (
                    <>
                      <span className="capitalize">{actividad.ultimoMovimiento.tipo}</span>
                      {" · "}
                      {formatFechaCorta(actividad.ultimoMovimiento.fecha)}
                      <br />
                      <Link
                        href={`/dashboard/clientes/${actividad.ultimoMovimiento.clienteId}`}
                        className="font-semibold text-emerald-800 hover:underline dark:text-emerald-400"
                      >
                        {actividad.ultimoMovimiento.clienteNombre}
                      </Link>
                      <span className="text-slate-500 dark:text-slate-400">
                        {" "}
                        — {actividad.ultimoMovimiento.descripcion.slice(0, 72)}
                        {actividad.ultimoMovimiento.descripcion.length > 72 ? "…" : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500">Sin movimientos aún.</span>
                  )}
                </span>
              </li>
              <li className="flex gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="w-9 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                  Prov.
                </span>
                <span>
                  {actividad.ultimoMovimientoProveedor ? (
                    <>
                      <span className="capitalize">{actividad.ultimoMovimientoProveedor.tipo}</span>
                      {" · "}
                      {formatFechaCorta(actividad.ultimoMovimientoProveedor.fecha)}
                      <br />
                      <Link
                        href={`/dashboard/proveedores/${actividad.ultimoMovimientoProveedor.proveedorId}`}
                        className="font-semibold text-amber-900 hover:underline dark:text-amber-200"
                      >
                        {actividad.ultimoMovimientoProveedor.proveedorNombre}
                      </Link>
                      <span className="text-slate-500 dark:text-slate-400">
                        {" "}
                        — {actividad.ultimoMovimientoProveedor.descripcion.slice(0, 72)}
                        {actividad.ultimoMovimientoProveedor.descripcion.length > 72 ? "…" : ""}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500">Sin movimientos proveedor aún.</span>
                  )}
                </span>
              </li>
              <li className="flex gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="w-9 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                  PDF
                </span>
                <span>
                  {actividad.ultimoPdf ? (
                    <>
                      {formatFechaCorta(actividad.ultimoPdf.createdAt)}
                      {" · "}
                      <span className="font-medium">{actividad.ultimoPdf.nombre ?? "Archivo"}</span>
                      <br />
                      <Link
                        href={`/dashboard/clientes/${actividad.ultimoPdf.clienteId}`}
                        className="text-emerald-800 hover:underline dark:text-emerald-400"
                      >
                        {actividad.ultimoPdf.clienteNombre}
                      </Link>
                    </>
                  ) : (
                    <span className="text-slate-500">Sin PDFs aún.</span>
                  )}
                </span>
              </li>
              <li className="flex gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="w-9 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                  Cliente
                </span>
                <span>
                  {actividad.ultimoCliente ? (
                    <>
                      <Link
                        href={`/dashboard/clientes/${actividad.ultimoCliente.id}`}
                        className="font-semibold text-emerald-800 hover:underline dark:text-emerald-400"
                      >
                        {actividad.ultimoCliente.nombre}
                      </Link>
                      <span className="text-slate-500 dark:text-slate-400">
                        {" "}
                        · alta {formatFechaCorta(actividad.ultimoCliente.createdAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="w-9 shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                  Prov.
                </span>
                <span>
                  {actividad.ultimoProveedor ? (
                    <>
                      <Link
                        href={`/dashboard/proveedores/${actividad.ultimoProveedor.id}`}
                        className="font-semibold text-amber-900 hover:underline dark:text-amber-200"
                      >
                        {actividad.ultimoProveedor.nombre}
                      </Link>
                      <span className="text-slate-500 dark:text-slate-400">
                        {" "}
                        · alta {formatFechaCorta(actividad.ultimoProveedor.createdAt)}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </span>
              </li>
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
