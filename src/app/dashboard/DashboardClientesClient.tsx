"use client";

import { ClientesTable, type ClienteTablaRow } from "@/components/clientes/ClientesTable";
import { FiltrosClientes } from "@/components/clientes/FiltrosClientes";
import { IconSearch } from "@/components/UiIcons";
import type { FiltroClientesTabla, OrdenClientesTabla } from "@/types/clientes-tabla";
import { esEstadoGestionCuenta } from "@/types/estado-gestion-cuenta";
import type { EstadoGestionCuenta } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const PAGE_LIMIT = 50;

function parseEstadoGestion(raw: unknown): EstadoGestionCuenta {
  return typeof raw === "string" && esEstadoGestionCuenta(raw) ? raw : "FALTA_PAGO";
}

function mapObrasEstadoApi(raw: unknown): ClienteTablaRow["obrasEstado"] {
  if (!Array.isArray(raw)) return [];
  const out: ClienteTablaRow["obrasEstado"] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? "");
    if (!id) continue;
    out.push({
      id,
      nombre: String(o.nombre ?? ""),
      estadoGestionCuenta: parseEstadoGestion(o.estadoGestionCuenta),
    });
  }
  return out;
}

function mapApiToRow(raw: Record<string, unknown>): ClienteTablaRow {
  const ult = raw.ultimoMovimientoFecha;
  return {
    id: String(raw.id),
    nombre: String(raw.nombre ?? ""),
    tipo: String(raw.tipo ?? ""),
    cuit: (raw.cuit as string | null) ?? null,
    telefono: (raw.telefono as string | null) ?? null,
    saldo: Number(raw.saldo ?? 0),
    deudaMas90: raw.deudaMas90 != null ? Number(raw.deudaMas90) : undefined,
    estadoCobranza: raw.estadoCobranza as ClienteTablaRow["estadoCobranza"],
    estadoGestionCuenta: parseEstadoGestion(raw.estadoGestionCuenta),
    obrasEstado: mapObrasEstadoApi(raw.obrasEstado),
    diasSinPagar:
      raw.diasSinPagar === null || raw.diasSinPagar === undefined
        ? null
        : Number(raw.diasSinPagar),
    saldoVencido60: Number(raw.saldoVencido60 ?? 0),
    ultimoMovimientoFecha:
      ult === null || ult === undefined
        ? null
        : typeof ult === "string"
          ? ult
          : (ult as Date).toISOString?.() ?? String(ult),
    obrasCount: Number(raw.obrasCount ?? 0),
  };
}

export function DashboardClientesClient({
  initialQ,
  initialFiltro,
  initialOrderBy,
  initialClientes,
  initialNextCursor,
  showCargarPagoButton = false,
  hideSearchBar = false,
  showEstadoCuentaColumn = true,
}: {
  initialQ: string;
  initialFiltro: FiltroClientesTabla;
  initialOrderBy: OrdenClientesTabla;
  initialClientes: ClienteTablaRow[];
  initialNextCursor: string | null;
  /** En el panel principal los mismos enlaces van en el encabezado (`DashboardPrimaryActions`). */
  showCargarPagoButton?: boolean;
  /** La búsqueda vive en `DashboardPanelTopBar` (`?q=`). */
  hideSearchBar?: boolean;
  /** Columna de desplegables de gestión: solo en la página Clientes, no en la vista previa del dashboard. */
  showEstadoCuentaColumn?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const debouncedQ = useDebouncedValue(q, 300);
  const [filtro, setFiltro] = useState<FiltroClientesTabla>(initialFiltro);
  const [orderBy, setOrderBy] = useState<OrdenClientesTabla>(
    initialOrderBy === "dias_sin_pagar" ? "nombre" : initialOrderBy,
  );
  const [clientes, setClientes] = useState<ClienteTablaRow[]>(initialClientes);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const nextCursorRef = useRef<string | null>(initialNextCursor);
  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ]);

  const hayBusqueda = Boolean(q.trim());

  useEffect(() => {
    if (hideSearchBar) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth > 768) {
      searchInputRef.current?.focus();
    }
  }, [hideSearchBar]);

  const fetchPage = useCallback(
    async (opts: {
      q: string;
      filtro: FiltroClientesTabla;
      orderBy: OrdenClientesTabla;
      cursor: string | null;
      append: boolean;
      signal: AbortSignal;
    }) => {
      const params = new URLSearchParams();
      params.set("pageMode", "cursor");
      params.set("listMode", "tabla");
      params.set("limit", String(PAGE_LIMIT));
      params.set("filtro", opts.filtro);
      params.set("orderBy", opts.orderBy);
      if (opts.q.trim()) params.set("q", opts.q.trim());
      if (opts.cursor) params.set("cursor", opts.cursor);

      const res = await fetch(`/api/clientes?${params.toString()}`, {
        credentials: "same-origin",
        signal: opts.signal,
      });
      const data = (await res.json()) as {
        clientes?: Record<string, unknown>[];
        nextCursor?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Error");
      const rows = (data.clientes ?? []).map(mapApiToRow);
      const nc = data.nextCursor ?? null;
      if (opts.append) {
        setClientes((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          const extra = rows.filter((r) => !seen.has(r.id));
          return [...prev, ...extra];
        });
      } else {
        setClientes(rows);
      }
      setNextCursor(nc);
    },
    [],
  );

  /** Tras PATCH de estado, `router.refresh()` no actualiza `useState(initialClientes)`: hay que volver a pedir `/api/clientes`. */
  const recargarFilasTrasEstado = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      await fetchPage({
        q: debouncedQ,
        filtro,
        orderBy,
        cursor: null,
        append: false,
        signal: ac.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [debouncedQ, filtro, orderBy, fetchPage]);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        await fetchPage({
          q: debouncedQ,
          filtro,
          orderBy,
          cursor: null,
          append: false,
          signal: ac.signal,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [debouncedQ, filtro, orderBy, fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        const cur = nextCursorRef.current;
        if (!hit || loadingMore || loading || !cur) return;
        setLoadingMore(true);
        setError(null);
        const ac = new AbortController();
        void (async () => {
          try {
            await fetchPage({
              q: debouncedQ,
              filtro,
              orderBy,
              cursor: cur,
              append: true,
              signal: ac.signal,
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error");
          } finally {
            setLoadingMore(false);
          }
        })();
      },
      { root: null, rootMargin: "120px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadingMore, loading, debouncedQ, filtro, orderBy, fetchPage, nextCursor]);

  return (
    <section className="space-y-4">
      {!hideSearchBar ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Buscar clientes</h2>
            {showCargarPagoButton ? (
              <Link href="/dashboard/carga" className="btn-primary text-sm">
                Registrar cobro
              </Link>
            ) : null}
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <IconSearch className="size-5" />
            </span>
            <input
              id="q"
              ref={searchInputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, CUIT, teléfono o comprobante"
              className="input-app h-12 pl-11 text-base shadow-sm dark:border-slate-700 dark:bg-slate-900"
              autoComplete="off"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">{loading ? "Buscando…" : "\u00a0"}</span>
              {hayBusqueda && (
                <button type="button" className="btn-tertiary" onClick={() => setQ("")}>
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtro rápido</p>
        <FiltrosClientes value={filtro} disabled={loading} onChange={setFiltro} />
        {hideSearchBar && hayBusqueda ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-tertiary text-xs"
              onClick={() => {
                setQ("");
                router.replace("/dashboard", { scroll: false });
              }}
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="alert-error" role="alert">
          {error}
        </p>
      ) : null}

      {!hideSearchBar ? (
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Resultados</h3>
          <span className="section-count">{clientes.length} mostrados</span>
        </div>
      ) : null}

      {(clientes.length > 0 || loading) && (
        <ClientesTable
          rows={clientes}
          orderBy={orderBy}
          onOrderByChange={setOrderBy}
          sentinelRef={sentinelRef}
          loadingMore={loadingMore}
          onEstadoGestionGuardado={recargarFilasTrasEstado}
          showEstadoCuentaColumn={showEstadoCuentaColumn}
        />
      )}

      {clientes.length === 0 && !loading ? (
        <div className="empty-state border-0 bg-transparent">
          <p className="empty-state-title">
            {debouncedQ.trim() ? "No hay clientes que coincidan" : "Todavía no hay clientes"}
          </p>
          <p className="empty-state-hint">
            {debouncedQ.trim()
              ? "Probá otra búsqueda o ajustá el filtro."
              : "Creá un cliente y registrá movimientos o subí un PDF de comprobante."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
