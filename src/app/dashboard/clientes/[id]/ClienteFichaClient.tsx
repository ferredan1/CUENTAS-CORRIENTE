"use client";

import { ObraMovimientosClient } from "@/app/dashboard/obras/[id]/ObraMovimientosClient";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BorrarClienteButton } from "@/components/BorrarClienteButton";
import { BorrarObraButton } from "@/components/BorrarObraButton";
import { BorrarComprobanteButton } from "./BorrarComprobanteButton";
import { MarcarComprobanteButton } from "./MarcarComprobanteButton";
import { DatosClienteForm } from "./DatosClienteForm";
import { NuevaObraForm } from "./NuevaObraForm";
import { ETIQUETA_ESTADO_GESTION } from "@/types/estado-gestion-cuenta";
type ArchivoDTO = {
  id: string;
  nombre: string | null;
  createdAt: string;
  obra: { id: string; nombre: string } | null;
  comprobante: string | null;
  ventasCount: number;
  ventasPagadas: number;
};

type ObraSaldoDTO = {
  id: string;
  nombre: string;
  saldo: number;
  estadoSaldo: "sin_facturar" | "cerrado_facturado" | "enviado_pendiente_pago";
};

export type ClienteFichaDTO = {
  id: string;
  nombre: string;
  tipo: string;
  nombrePersona: string | null;
  apellido: string | null;
  cuit: string | null;
  email: string | null;
  telefono: string | null;
  saldo: number;
  estadoCobranza: "al_dia" | "en_gestion" | "moroso" | "incobrable";
  saldoEfectivo: number;
  totalChequesPendientes: number;
  saldoSinObra: number;
  movimientosCount: number;
  updatedAt: string;
  archivos: ArchivoDTO[];
  obrasConSaldo: ObraSaldoDTO[];
  ultimoMovimiento: { fecha: string; descripcion: string; tipo: string } | null;
  antiguedadDeuda: {
    corriente: number;
    dias30a60: number;
    dias60a90: number;
    masde90: number;
  };
  ultimoPago: { fecha: string; total: number; medioPago: string | null } | null;
  promedioDiasPago: number | null;
};

const TABS = [
  { id: "resumen" as const, label: "Resumen" },
  { id: "movimientos" as const, label: "Movimientos" },
  { id: "comprobantes" as const, label: "Comprobantes" },
  { id: "obras" as const, label: "Obras" },
  { id: "datos" as const, label: "Datos" },
];

type TabId = (typeof TABS)[number]["id"];

export function ClienteFichaClient({ c }: { c: ClienteFichaDTO }) {
  async function patchEstadoSaldoObra(obraId: string, estadoSaldo: ObraSaldoDTO["estadoSaldo"]) {
    try {
      const res = await fetch(`/api/obras/${obraId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estadoSaldo }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo actualizar");
      window.location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }
  const [tab, setTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "resumen";
    const raw = window.location.hash.replace(/^#/, "").trim();
    if (!raw) return "resumen";
    const found = TABS.find((t) => t.id === raw);
    return found?.id ?? "resumen";
  });

  const ultimoPdf = c.archivos[0] ?? null;
  const tabsWithCounts = useMemo(() => {
    const counts: Partial<Record<TabId, number>> = {
      movimientos: c.movimientosCount,
      comprobantes: c.archivos.length,
      obras: c.obrasConSaldo.length,
    };
    return TABS.map((t) => ({
      ...t,
      count: counts[t.id],
    }));
  }, [c.archivos.length, c.movimientosCount, c.obrasConSaldo.length]);

  useEffect(() => {
    const nextHash = `#${tab}`;
    if (window.location.hash === nextHash) return;
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", `${base}${nextHash}`);
  }, [tab]);

  const badgeSaldo = useMemo(() => {
    if (c.saldo > 0) return { text: "Saldo a cobrar", className: "badge-debt" };
    if (c.saldo < 0) return { text: "Saldo a favor", className: "badge-ok" };
    return { text: "Sin deuda", className: "badge-ok" };
  }, [c.saldo]);

  const badgeCobranza = useMemo(() => {
    if (!(c.saldo > 0)) return null;
    if (c.estadoCobranza === "en_gestion")
      return {
        text: "En gestión",
        className:
          "rounded-md bg-yellow-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-yellow-950 dark:bg-yellow-950/35 dark:text-yellow-100",
      };
    if (c.estadoCobranza === "moroso")
      return {
        text: "Moroso",
        className:
          "rounded-md bg-orange-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-950 dark:bg-orange-950/40 dark:text-orange-100",
      };
    if (c.estadoCobranza === "incobrable")
      return {
        text: "Incobrable",
        className:
          "rounded-md bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-red-900 dark:bg-red-950/45 dark:text-red-200",
      };
    return {
      text: "Al día",
      className:
        "rounded-md bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-900 dark:bg-emerald-950/45 dark:text-emerald-200",
    };
  }, [c.estadoCobranza, c.saldo]);

  const comprobantesRecientes = c.archivos.slice(0, 5);

  function estadoArchivo(a: ArchivoDTO): "Sin ventas" | "Pagado" | "Parcial" | "Pendiente" {
    if (a.ventasCount <= 0) return "Sin ventas";
    if (a.ventasPagadas >= a.ventasCount) return "Pagado";
    if (a.ventasPagadas > 0) return "Parcial";
    return "Pendiente";
  }

  const estadoSaldoLabel: Record<ObraSaldoDTO["estadoSaldo"], string> = {
    cerrado_facturado: ETIQUETA_ESTADO_GESTION.CUENTA_CERRADA,
    enviado_pendiente_pago: ETIQUETA_ESTADO_GESTION.FACTURADO_ENVIADO,
    sin_facturar: ETIQUETA_ESTADO_GESTION.FALTA_PAGO,
  };

  return (
    <>
      <nav className="breadcrumb-muted" aria-label="Migas de pan">
        <Link href="/dashboard">Clientes</Link>
        <span aria-hidden>/</span>
        <span className="text-slate-600">{c.nombre}</span>
      </nav>

      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">{c.nombre}</h1>
          <p className="mt-1.5 text-xs font-medium text-slate-600">
            <span className="capitalize">{c.tipo}</span>
            <span className="mx-1.5 font-normal text-slate-300">·</span>
            <span>{c.obrasConSaldo.length} obra{c.obrasConSaldo.length === 1 ? "" : "s"}</span>
            <span className="mx-1.5 font-normal text-slate-300">·</span>
            <span>{c.archivos.length} comprobante{c.archivos.length === 1 ? "" : "s"}</span>
            <span className="mx-1.5 font-normal text-slate-300">·</span>
            <span>{c.movimientosCount} movimientos</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/upload?clienteId=${c.id}`} className="btn-secondary">
            Nueva venta
          </Link>
          <Link href={`/dashboard/carga?clienteId=${c.id}`} className="btn-primary">
            Registrar movimiento
          </Link>
          <Link
            href={`/dashboard/clientes/${c.id}/estado-cuenta`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-tertiary"
          >
            Estado de cuenta
          </Link>
          <div className="mt-1 w-full border-t border-slate-200 pt-3 lg:mt-0 lg:w-auto lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
            <BorrarClienteButton
              clienteId={c.id}
              nombre={c.nombre}
              saldo={c.saldo}
              className="btn-ghost btn-danger-ghost text-sm opacity-90 hover:opacity-100"
            />
          </div>
        </div>
      </header>

      <div className="segmented flex w-full min-w-0 max-w-3xl touch-pan-x">
        {tabsWithCounts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`segmented-btn ${tab === t.id ? "segmented-btn-active" : ""}`}
          >
            <span className="inline-flex items-center gap-2">
              <span>{t.label}</span>
              {typeof t.count === "number" ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold tabular-nums ${
                    tab === t.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/70 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  }`}
                  aria-label={`${t.count}`}
                >
                  {t.count}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      {tab === "resumen" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className={`rounded-xl border p-4 shadow-sm ${
                c.saldo > 0
                  ? "border-rose-200/80 bg-rose-50/20"
                  : "border-emerald-200/70 bg-emerald-50/15"
              }`}
            >
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                Saldo total
              </p>
              <p
                className={`mt-1 font-mono text-3xl font-bold tabular-nums ${
                  c.saldo > 0 ? "text-rose-700" : c.saldo < 0 ? "text-emerald-700" : "text-slate-800"
                }`}
              >
                {formatMoneda(c.saldo)}
              </p>
              <p className="mt-2">
                <span className={badgeSaldo.className}>{badgeSaldo.text}</span>
                {badgeCobranza ? (
                  <span className={`ml-2 ${badgeCobranza.className}`}>{badgeCobranza.text}</span>
                ) : null}
              </p>
              {c.totalChequesPendientes > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wide text-amber-900">
                    Cheques pendientes
                  </p>
                  <p className="mt-1 text-xs text-amber-950/80">
                    Pendiente:{" "}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatMoneda(c.totalChequesPendientes)}
                    </span>{" "}
                    · Saldo efectivo:{" "}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatMoneda(c.saldoEfectivo)}
                    </span>
                  </p>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
                Actividad
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>
                  <span className="text-slate-500">Último movimiento: </span>
                  {c.ultimoMovimiento ? (
                    <>
                      <span className="capitalize">{c.ultimoMovimiento.tipo}</span>
                      {" · "}
                      {formatFechaCorta(c.ultimoMovimiento.fecha)}
                      {" — "}
                      <span className="text-slate-600">{c.ultimoMovimiento.descripcion.slice(0, 80)}</span>
                      {c.ultimoMovimiento.descripcion.length > 80 ? "…" : ""}
                    </>
                  ) : (
                    "—"
                  )}
                </li>
                <li>
                  <span className="text-slate-500">Último PDF: </span>
                  {ultimoPdf ? (
                    <>
                      {formatFechaCorta(ultimoPdf.createdAt)}
                      {" · "}
                      <span className="font-medium">{ultimoPdf.nombre ?? "PDF"}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </li>
                <li>
                  <span className="text-slate-500">Actualizado: </span>
                  {formatFechaCorta(c.updatedAt)}
                </li>
                <li>
                  <span className="text-slate-500">Último pago: </span>
                  {c.ultimoPago ? (
                    <>
                      <span className="font-mono font-semibold tabular-nums text-slate-900">
                        {formatMoneda(c.ultimoPago.total)}
                      </span>
                      <span className="text-slate-500">
                        {" "}
                        · {formatFechaCorta(c.ultimoPago.fecha)}
                        {c.ultimoPago.medioPago ? ` · ${c.ultimoPago.medioPago}` : ""}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-rose-700">Nunca pagó</span>
                  )}
                </li>
                <li>
                  <span className="text-slate-500">Promedio de pago: </span>
                  {typeof c.promedioDiasPago === "number" ? (
                    <span className="font-mono font-semibold tabular-nums text-slate-900">
                      {c.promedioDiasPago} días
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </li>
              </ul>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
              Antigüedad de deuda (ventas pendientes)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">&lt; 30 días</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {formatMoneda(c.antiguedadDeuda.corriente ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">30–60</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {formatMoneda(c.antiguedadDeuda.dias30a60 ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">60–90</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                  {formatMoneda(c.antiguedadDeuda.dias60a90 ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">&gt; 90</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-rose-700">
                  {formatMoneda(c.antiguedadDeuda.masde90 ?? 0)}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="section-header border-0 pb-0">
              <h2 className="section-title">Movimientos sin obra</h2>
            </div>
            <ObraMovimientosClient sinObra clienteId={c.id} saldoObra={c.saldoSinObra} />
          </section>

          <section className="space-y-3">
            <div className="section-header border-0 pb-0">
              <h2 className="section-title">Obras activas</h2>
            </div>
            <div className="table-shell">
              <table className="table-app">
                <thead>
                  <tr>
                    <th>Obra</th>
                    <th className="w-36 text-right">Saldo</th>
                    <th className="w-32"> </th>
                  </tr>
                </thead>
                <tbody>
                  {c.obrasConSaldo.map((o) => (
                    <tr key={o.id}>
                      <td className="font-medium">{o.nombre}</td>
                      <td
                        className={`text-right font-mono tabular-nums ${
                          o.saldo > 0 ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {formatMoneda(o.saldo)}
                      </td>
                      <td>
                        <Link href={`/dashboard/obras/${o.id}`} className="link-app text-sm">
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {c.obrasConSaldo.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-500">
                        Sin obras. Creá una en la pestaña «Obras».
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div className="section-header border-0 pb-0">
              <h2 className="section-title">Comprobantes recientes</h2>
            </div>
            <div className="table-shell">
              <table className="table-app w-full min-w-[min(100%,28rem)]">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Archivo</th>
                    <th>Obra</th>
                    <th className="w-20"> </th>
                  </tr>
                </thead>
                <tbody>
                  {comprobantesRecientes.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap text-slate-600">
                        {formatFechaCorta(a.createdAt)}
                      </td>
                      <td className="max-w-[180px] truncate font-medium">{a.nombre ?? "—"}</td>
                      <td className="text-slate-600">{a.obra?.nombre ?? "—"}</td>
                      <td>
                        <a
                          href={`/api/archivos/${a.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link-app text-sm"
                        >
                          Abrir
                        </a>
                      </td>
                    </tr>
                  ))}
                  {comprobantesRecientes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500">
                        Sin comprobantes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "movimientos" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Todos los movimientos del cliente (todas las obras y sin obra). Podés registrar movimientos desde acá.
          </p>
          <ObraMovimientosClient todoCliente clienteId={c.id} saldoObra={c.saldo} />
        </div>
      )}

      {tab === "comprobantes" && (
        <div className="table-shell">
          <table className="table-app w-full max-w-full min-w-[min(100%,32rem)] sm:min-w-[560px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Comprobante</th>
                <th>Obra</th>
                <th className="w-28">Estado</th>
                <th className="w-24">Ver</th>
                <th className="w-24"> </th>
              </tr>
            </thead>
            <tbody>
              {c.archivos.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-slate-600">{formatFechaCorta(a.createdAt)}</td>
                  <td className="font-mono text-sm font-semibold tabular-nums">
                    {a.comprobante ?? "—"}
                  </td>
                  <td className="text-slate-600">{a.obra?.nombre ?? "—"}</td>
                  <td>
                    <span
                      className={
                        estadoArchivo(a) === "Pagado"
                          ? "badge-ok"
                          : estadoArchivo(a) === "Parcial"
                            ? "badge-warn"
                            : estadoArchivo(a) === "Pendiente"
                              ? "badge-debt"
                              : "badge-ok"
                      }
                    >
                      {estadoArchivo(a)}
                    </span>
                    {a.ventasCount > 0 ? (
                      <span className="ml-2 text-xs text-slate-500">
                        {a.ventasPagadas}/{a.ventasCount}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <a
                      href={`/api/archivos/${a.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-app text-sm"
                    >
                      Abrir
                    </a>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      {a.ventasPagadas < a.ventasCount ? (
                        <MarcarComprobanteButton archivoId={a.id} />
                      ) : null}
                      <BorrarComprobanteButton archivoId={a.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {c.archivos.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Sin comprobantes. Subí un PDF desde el encabezado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "obras" && (
        <div className="space-y-4">
          <NuevaObraForm clienteId={c.id} />
          <div className="table-shell">
            <table className="table-app">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="w-56">Estado saldo</th>
                  <th className="w-36 text-right">Saldo</th>
                  <th className="w-40"> </th>
                  <th className="w-28 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {c.obrasConSaldo.map((o) => (
                  <tr key={o.id}>
                    <td className="font-medium text-slate-900">{o.nombre}</td>
                    <td>
                      <select
                        className="select-app text-sm"
                        value={o.estadoSaldo}
                        onChange={(e) => void patchEstadoSaldoObra(o.id, e.target.value as ObraSaldoDTO["estadoSaldo"])}
                      >
                        <option value="cerrado_facturado">{estadoSaldoLabel.cerrado_facturado}</option>
                        <option value="enviado_pendiente_pago">{estadoSaldoLabel.enviado_pendiente_pago}</option>
                        <option value="sin_facturar">{estadoSaldoLabel.sin_facturar}</option>
                      </select>
                    </td>
                    <td
                      className={`text-right font-mono tabular-nums font-medium ${
                        o.saldo > 0 ? "text-rose-700" : "text-emerald-700"
                      }`}
                    >
                      {formatMoneda(o.saldo)}
                    </td>
                    <td>
                      <Link href={`/dashboard/obras/${o.id}`} className="link-app text-sm">
                        Ver obra
                      </Link>
                    </td>
                    <td className="text-right">
                      <BorrarObraButton
                        obraId={o.id}
                        nombre={o.nombre}
                        clienteId={c.id}
                        alExito="refrescar"
                        etiqueta="Eliminar"
                        className="btn-ghost btn-danger-ghost py-1 px-2 text-xs opacity-70 hover:opacity-100 disabled:opacity-50"
                      />
                    </td>
                  </tr>
                ))}
                {c.obrasConSaldo.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      Sin obras. Creá una arriba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "datos" && (
        <DatosClienteForm
          clienteId={c.id}
          nombre={c.nombre}
          tipo={c.tipo}
          nombrePersona={c.nombrePersona}
          apellido={c.apellido}
          cuit={c.cuit}
          email={c.email}
          telefono={c.telefono}
        />
      )}
    </>
  );
}
