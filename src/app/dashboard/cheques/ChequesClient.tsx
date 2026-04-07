"use client";

import type { ChequeListItem } from "@/services/cheques";
import { formatFechaCorta, formatMoneda } from "@/lib/format";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function badgeEstado(estado: "vencido" | "por_vencer" | "sin_vencimiento") {
  if (estado === "vencido") return <span className="badge-debt">Vencido</span>;
  if (estado === "por_vencer") return <span className="badge-pending">Por vencer / al día</span>;
  return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Sin vto.</span>;
}

type EstadoCheque = "en_cartera" | "depositado" | "acreditado" | "rechazado";

type Filtro = "todos" | "por_vencer" | "vencido" | "sin_vencimiento";

function parseFiltroQuery(v: string | null): Filtro {
  if (v === "por_vencer" || v === "vencido" || v === "sin_vencimiento") return v;
  return "todos";
}

function inicioDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function claseFilaPorVencimientoCheque(chequeVencimiento: string | null, estado: ChequeListItem["estado"]): string {
  if (!chequeVencimiento || estado === "sin_vencimiento") return "";
  const vto = inicioDia(new Date(chequeVencimiento));
  if (Number.isNaN(vto.getTime())) return "";
  const hoy = inicioDia(new Date());
  if (vto < hoy) return "bg-rose-50 dark:bg-rose-950/25";
  const en7 = new Date(hoy);
  en7.setDate(en7.getDate() + 7);
  if (vto <= en7) return "bg-amber-50 dark:bg-amber-950/25";
  return "";
}

export function ChequesClient({ chequesAll }: { chequesAll: ChequeListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtro, setFiltroState] = useState<Filtro>(() => parseFiltroQuery(searchParams.get("estado")));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [estadoById, setEstadoById] = useState<Record<string, EstadoCheque | "">>(() =>
    Object.fromEntries(
      chequesAll.map((c) => [c.id, (c.estadoCheque ?? "") as EstadoCheque | ""]),
    ),
  );

  useEffect(() => {
    setFiltroState(parseFiltroQuery(searchParams.get("estado")));
  }, [searchParams]);

  useEffect(() => {
    setEstadoById(
      Object.fromEntries(
        chequesAll.map((c) => [c.id, (c.estadoCheque ?? "") as EstadoCheque | ""]),
      ),
    );
  }, [chequesAll]);

  function setFiltro(next: Filtro) {
    setFiltroState(next);
    const p = new URLSearchParams(searchParams.toString());
    if (next === "todos") p.delete("estado");
    else p.set("estado", next);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const counts = useMemo(
    () => ({
      por_vencer: chequesAll.filter((c) => c.estado === "por_vencer").length,
      vencido: chequesAll.filter((c) => c.estado === "vencido").length,
      sin_vencimiento: chequesAll.filter((c) => c.estado === "sin_vencimiento").length,
    }),
    [chequesAll],
  );
  const cheques = useMemo(
    () => (filtro === "todos" ? chequesAll : chequesAll.filter((c) => c.estado === filtro)),
    [chequesAll, filtro],
  );

  return (
    <div className="page-shell">
      <header className="flex flex-col gap-2 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Cheques</h1>
          <p className="page-subtitle-quiet max-w-xl">
            Pagos en cheque con fecha de recepción, vencimiento, importe y estado según el vencimiento.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard" className="btn-secondary shrink-0">
            Volver al panel
          </Link>
          <Link href="/dashboard/carga" className="btn-tertiary shrink-0">
            Cargar pago
          </Link>
        </div>
      </header>

      {err ? (
        <p className="alert-error" role="alert">
          {err}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltro("todos")}
          className={`btn-secondary h-9 px-3 py-0 text-xs ${filtro === "todos" ? "" : "opacity-80"}`}
        >
          Todos ({chequesAll.length})
        </button>
        <button
          type="button"
          onClick={() => setFiltro("por_vencer")}
          className={`btn-secondary h-9 px-3 py-0 text-xs ${filtro === "por_vencer" ? "" : "opacity-80"}`}
        >
          Por vencer ({counts.por_vencer})
        </button>
        <button
          type="button"
          onClick={() => setFiltro("vencido")}
          className={`btn-secondary h-9 px-3 py-0 text-xs ${filtro === "vencido" ? "" : "opacity-80"}`}
        >
          Vencidos ({counts.vencido})
        </button>
        <button
          type="button"
          onClick={() => setFiltro("sin_vencimiento")}
          className={`btn-secondary h-9 px-3 py-0 text-xs ${filtro === "sin_vencimiento" ? "" : "opacity-80"}`}
        >
          Sin vto. ({counts.sin_vencimiento})
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            const XLSX = await import("xlsx");
            const ws = XLSX.utils.json_to_sheet(
              chequesAll.map((c) => ({
                Cliente: c.clienteNombre,
                Obra: c.obraNombre ?? "",
                Banco: c.chequeBanco ?? "",
                "Nº Cheque": c.chequeNumero ?? "",
                "Fecha recepción": c.fechaRecepcion ? formatFechaCorta(c.fechaRecepcion) : "",
                "Vencimiento": c.chequeVencimiento ? formatFechaCorta(c.chequeVencimiento) : "",
                Monto: c.total,
                Estado: c.estado,
                Imputación: formatFechaCorta(c.fecha),
                Descripción: c.descripcion,
              })),
            );
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Cheques");
            XLSX.writeFile(wb, `cheques-${new Date().toISOString().slice(0, 10)}.xlsx`);
          }}
        >
          Exportar
        </button>
      </div>

      <div className="table-shell">
        <table className="table-app w-full min-w-[min(100%,48rem)]">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Obra</th>
              <th>Banco</th>
              <th>Recibido</th>
              <th>Nº cheque</th>
              <th>Vencimiento</th>
              <th className="text-right">Monto</th>
              <th>Vto.</th>
              <th>Estado</th>
              <th>Imputación</th>
            </tr>
          </thead>
          <tbody>
            {cheques.map((c) => (
              <tr key={c.id} className={claseFilaPorVencimientoCheque(c.chequeVencimiento, c.estado)}>
                <td className="font-medium text-slate-900">
                  <Link href={`/dashboard/clientes/${c.clienteId}`} className="link-app">
                    {c.clienteNombre}
                  </Link>
                </td>
                <td className="text-slate-600">
                  {c.obraNombre ? (
                    c.obraId ? (
                      <Link href={`/dashboard/obras/${c.obraId}`} className="link-app">
                        {c.obraNombre}
                      </Link>
                    ) : (
                      c.obraNombre
                    )
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-slate-600">{c.chequeBanco ?? "—"}</td>
                <td className="whitespace-nowrap text-slate-600">
                  {c.fechaRecepcion ? formatFechaCorta(c.fechaRecepcion) : "—"}
                </td>
                <td className="font-mono text-sm">{c.chequeNumero ?? "—"}</td>
                <td className="whitespace-nowrap text-slate-600">
                  {c.chequeVencimiento ? formatFechaCorta(c.chequeVencimiento) : "—"}
                </td>
                <td className="text-right font-mono tabular-nums font-medium text-slate-800">
                  {formatMoneda(c.total)}
                </td>
                <td>{badgeEstado(c.estado)}</td>
                <td>
                  <select
                    value={estadoById[c.id] ?? ""}
                    disabled={saving[c.id] === true}
                    onChange={(e) => {
                      const next = e.target.value as EstadoCheque | "";
                      setEstadoById((prev) => ({ ...prev, [c.id]: next }));
                      setErr(null);
                      setSaving((prev) => ({ ...prev, [c.id]: true }));
                      void (async () => {
                        try {
                          const res = await fetch(`/api/movimientos/${encodeURIComponent(c.id)}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ estadoCheque: next || null }),
                          });
                          const data = (await res.json()) as { error?: string };
                          if (!res.ok) throw new Error(data.error ?? "Error");
                        } catch (e2) {
                          setErr(e2 instanceof Error ? e2.message : "Error");
                        } finally {
                          setSaving((prev) => ({ ...prev, [c.id]: false }));
                        }
                      })();
                    }}
                    className="select-app h-8 text-xs"
                  >
                    <option value="">—</option>
                    <option value="en_cartera">En cartera</option>
                    <option value="depositado">Depositado</option>
                    <option value="acreditado">Acreditado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                </td>
                <td className="text-slate-500">{formatFechaCorta(c.fecha)}</td>
              </tr>
            ))}
            {cheques.length === 0 && (
              <tr>
                <td colSpan={10} className="py-14 text-center">
                  <div className="empty-state mx-auto max-w-md border-0 bg-transparent">
                    <p className="empty-state-title">
                      {filtro === "todos" ? "No hay cheques registrados" : "No hay cheques para este filtro"}
                    </p>
                    <p className="empty-state-hint">
                      Los cheques aparecen cuando cargás un pago con medio «Cheque» desde Cargar movimiento.
                    </p>
                    <Link href="/dashboard/carga" className="btn-primary mt-3">
                      Cargar pago
                    </Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

