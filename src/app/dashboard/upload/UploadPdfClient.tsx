"use client";

import type { ItemExtraido } from "@/services/extraer-lineas-comprobante";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type ClienteOpt = { id: string; nombre: string };
type ObraOpt = { id: string; nombre: string };
type ArchivoOpt = {
  id: string;
  nombre: string | null;
  url: string;
  createdAt: string;
  obraNombre: string | null;
};

type ImportacionComprobanteApi = {
  comprobante: string;
  items: number;
  movimientos: number;
  fecha?: string;
};

/** Un archivo subido y el resultado del auto-import (si hubo). */
type ResultadoSubidaPdf = {
  nombre: string;
  indice: number;
  total: number;
  verEn: string;
  storageEtiqueta: string;
  comprobantes: ImportacionComprobanteApi[];
  advertencias: string[];
};

function textoPareceDuplicadoComprobante(advertencias: string[]): boolean {
  const t = advertencias.join(" ").toLowerCase();
  return t.includes("duplicado") || t.includes("ya existen ventas") || t.includes("mismo número");
}

function resumenComprobanteImportado(c: ImportacionComprobanteApi): string {
  const base = `«${c.comprobante}»`;
  const mov = c.movimientos;
  const it = c.items;
  if (mov > 0) {
    const detalle =
      it !== mov ? `${mov} movimiento(s) (${it} línea(s) detectadas)` : `${mov} movimiento(s)`;
    return c.fecha ? `${base}: ${detalle} · ${c.fecha}` : `${base}: ${detalle}`;
  }
  return c.fecha ? `${base} · ${c.fecha}` : base;
}

function esPdf(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return true;
  const t = file.type.toLowerCase();
  return t === "application/pdf" || t === "application/x-pdf";
}

type UploadPdfProps = {
  initialClienteId?: string;
  initialObraId?: string;
};

export function UploadPdfClient({ initialClienteId, initialObraId }: UploadPdfProps = {}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDragDepthRef = useRef(0);
  const loadingSinceRef = useRef<number | null>(null);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [obras, setObras] = useState<ObraOpt[]>([]);
  const [clienteId, setClienteId] = useState(initialClienteId ?? "");
  const [obraId, setObraId] = useState(initialObraId ?? "");
  /** Uno o más PDF elegidos para subir de una vez. */
  const [filesSeleccionados, setFilesSeleccionados] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  /** Detalle por archivo tras subir (importación automática). */
  const [resultadoSubida, setResultadoSubida] = useState<ResultadoSubidaPdf[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);

  const [extractedItems, setExtractedItems] = useState<ItemExtraido[]>([]);
  const [comprobanteImport, setComprobanteImport] = useState("");
  const [textoMuestra, setTextoMuestra] = useState("");
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [errExtract, setErrExtract] = useState<string | null>(null);
  const [okImport, setOkImport] = useState<string | null>(null);
  const [archivosPdf, setArchivosPdf] = useState<ArchivoOpt[]>([]);
  const [archivoIdParaImport, setArchivoIdParaImport] = useState("");
  const [pdfDragActivo, setPdfDragActivo] = useState(false);
  /** El auto-import es el camino principal; el análisis manual se muestra solo si falló, o si el usuario lo abre. */
  const [mostrarManual, setMostrarManual] = useState(false);
  /** 1 contexto · 2 archivo · 3 análisis e importación */
  const [step, setStep] = useState(() => (initialClienteId ? 2 : 1));

  const cargarArchivosPdf = useCallback(async () => {
    if (!clienteId.trim()) {
      setArchivosPdf([]);
      setArchivoIdParaImport("");
      return;
    }
    const res = await fetch(`/api/archivos?clienteId=${encodeURIComponent(clienteId)}`, {
      credentials: "same-origin",
    });
    const data = (await res.json()) as ArchivoOpt[] | { error?: string };
    if (res.ok) setArchivosPdf(data as ArchivoOpt[]);
    else setArchivosPdf([]);
  }, [clienteId]);

  function resetFileInput() {
    setFilesSeleccionados([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function archivosParaSubir(): File[] {
    if (filesSeleccionados.length > 0) return filesSeleccionados;
    const fromInput = fileInputRef.current?.files;
    if (fromInput && fromInput.length > 0) {
      return Array.from(fromInput).filter(esPdf);
    }
    return [];
  }

  function aplicarArchivosPdfElegidos(lista: File[]) {
    const pdfs = lista.filter(esPdf);
    if (pdfs.length === 0) {
      if (lista.length > 0) {
        setErr("Solo se permiten archivos PDF (.pdf).");
      }
      return;
    }
    setErr(null);
    setFilesSeleccionados(pdfs);
  }

  function onPdfDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    pdfDragDepthRef.current += 1;
    setPdfDragActivo(true);
  }

  function onPdfDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    pdfDragDepthRef.current -= 1;
    if (pdfDragDepthRef.current <= 0) {
      pdfDragDepthRef.current = 0;
      setPdfDragActivo(false);
    }
  }

  function onPdfDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onPdfDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    pdfDragDepthRef.current = 0;
    setPdfDragActivo(false);
    aplicarArchivosPdfElegidos(Array.from(e.dataTransfer.files));
  }

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/clientes", { credentials: "same-origin" });
      const data = (await res.json()) as ClienteOpt[];
      if (res.ok) setClientes(data);
    })();
  }, []);

  useEffect(() => {
    if (!clienteId) {
      setObras([]);
      setObraId("");
      return;
    }
    void (async () => {
      const res = await fetch(`/api/obras?clienteId=${encodeURIComponent(clienteId)}`, {
        credentials: "same-origin",
      });
      const data = (await res.json()) as ObraOpt[] | { error?: string };
      if (res.ok) setObras(data as ObraOpt[]);
      else setObras([]);
    })();
  }, [clienteId]);

  useEffect(() => {
    if (initialClienteId) setClienteId(initialClienteId);
  }, [initialClienteId]);

  useEffect(() => {
    if (initialObraId) setObraId(initialObraId);
  }, [initialObraId]);

  useEffect(() => {
    void cargarArchivosPdf();
  }, [cargarArchivosPdf]);

  const autoImportExitoso =
    (resultadoSubida ?? []).some((r) => r.comprobantes.some((c) => c.movimientos > 0)) ||
    false;

  useEffect(() => {
    // Si el auto-import tuvo éxito, ocultamos el camino manual por defecto.
    // Si no hubo importación automática exitosa, mostramos el manual para resolver.
    if (step < 3) return;
    setMostrarManual(!autoImportExitoso);
  }, [autoImportExitoso, step]);

  useEffect(() => {
    if (!loading) {
      loadingSinceRef.current = null;
      setLoadingHint(null);
      return;
    }
    loadingSinceRef.current = Date.now();
    function hintForElapsed(ms: number): string {
      if (ms < 10_000) return "Subiendo archivo…";
      if (ms < 30_000) return "Extrayendo texto…";
      if (ms < 60_000) return "Importando movimientos…";
      return "Está tardando más de lo esperado (más de 60s). Si es un PDF grande, probá subir menos archivos a la vez o reintentá.";
    }
    setLoadingHint(hintForElapsed(0));
    const t = window.setInterval(() => {
      const start = loadingSinceRef.current ?? Date.now();
      setLoadingHint(hintForElapsed(Date.now() - start));
    }, 2000);
    return () => window.clearInterval(t);
  }, [loading]);

  /** Si hay una sola factura guardada y ya extrajiste ítems, vinculamos ese PDF automáticamente. */
  useEffect(() => {
    if (extractedItems.length === 0 || archivosPdf.length !== 1 || archivoIdParaImport) return;
    setArchivoIdParaImport(archivosPdf[0]!.id);
  }, [extractedItems.length, archivosPdf, archivoIdParaImport]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setResultadoSubida(null);

    if (!clienteId.trim()) {
      setErr("Seleccione un cliente.");
      return;
    }

    const lista = archivosParaSubir();
    if (lista.length === 0) {
      setErr("Seleccione uno o más archivos PDF.");
      return;
    }
    const noPdf = lista.filter((f) => !esPdf(f));
    if (noPdf.length > 0) {
      setErr("Solo se permiten archivos PDF (.pdf).");
      return;
    }

    setLoading(true);
    const bloquesErr: string[] = [];
    const exitosos: ResultadoSubidaPdf[] = [];
    let ultimoArchivoId = "";

    try {
      for (let i = 0; i < lista.length; i++) {
        const chosen = lista[i]!;
        const fd = new FormData();
        fd.set("file", chosen);
        fd.set("clienteId", clienteId);
        if (obraId) fd.set("obraId", obraId);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        });
        const data = (await res.json()) as {
          error?: string;
          archivo?: { id: string };
          verEn?: string;
          storage?: string;
          importacion?: {
            comprobantes: ImportacionComprobanteApi[];
            advertencias: string[];
          };
        };

        if (!res.ok) {
          bloquesErr.push(`${chosen.name}: ${data.error ?? "Error al subir"}`);
          continue;
        }

        const storageEtiqueta = data.storage === "local" ? "Disco local" : "Supabase";
        const enlace =
          data.verEn ??
          (data.archivo?.id ? `${window.location.origin}/api/archivos/${data.archivo.id}/file` : "");
        const imp = data.importacion;
        exitosos.push({
          nombre: chosen.name,
          indice: i + 1,
          total: lista.length,
          verEn: enlace || "#",
          storageEtiqueta,
          comprobantes: imp?.comprobantes ?? [],
          advertencias: Array.isArray(imp?.advertencias) ? imp.advertencias : [],
        });
        if (data.archivo?.id) ultimoArchivoId = data.archivo.id;
      }

      if (exitosos.length > 0) {
        setResultadoSubida(exitosos);
        setOk(
          exitosos.length === lista.length
            ? lista.length > 1
              ? `Se subieron los ${lista.length} PDF correctamente.`
              : "PDF subido correctamente."
            : `Se subieron ${exitosos.length} de ${lista.length} archivo(s); revisá los que fallaron abajo.`,
        );
      }
      if (bloquesErr.length > 0) {
        setErr(
          exitosos.length > 0
            ? `Algunos archivos fallaron:\n${bloquesErr.join("\n")}`
            : bloquesErr.join("\n"),
        );
      } else if (exitosos.length === 0) {
        setErr("No se pudo subir ningún archivo.");
      }

      if (ultimoArchivoId) {
        setArchivoIdParaImport(ultimoArchivoId);
        void cargarArchivosPdf();
      }
      resetFileInput();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  /** Para analizar manualmente: primer PDF de la selección. */
  function archivoElegido(): File | null {
    if (filesSeleccionados.length > 0) return filesSeleccionados[0]!;
    return fileInputRef.current?.files?.[0] ?? null;
  }

  async function onExtraerPdf() {
    setErrExtract(null);
    setOkImport(null);

    const chosen = archivoElegido();
    if (!chosen) {
      setErrExtract("Seleccione un archivo PDF.");
      return;
    }
    if (!esPdf(chosen)) {
      setErrExtract("El archivo debe ser PDF (.pdf).");
      return;
    }

    setLoadingExtract(true);
    try {
      const fd = new FormData();
      fd.set("file", chosen);
      const res = await fetch("/api/extraer-pdf", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const raw = await res.text();
      let data: {
        error?: string;
        detalle?: string;
        items?: ItemExtraido[];
        sugerenciaComprobante?: string;
        textoMuestra?: string;
        advertencias?: string[];
      } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw) as typeof data;
        } catch {
          throw new Error(
            "La respuesta del servidor no es JSON válido (cuerpo vacío o error interno). Revisá la terminal donde corre «next dev».",
          );
        }
      }
      if (!res.ok) {
        throw new Error(
          data.detalle ? `${data.error ?? "Error"} (${data.detalle})` : (data.error ?? `Error al extraer (${res.status})`),
        );
      }
      setExtractedItems(Array.isArray(data.items) ? data.items : []);
      setComprobanteImport(data.sugerenciaComprobante ?? "");
      setTextoMuestra(data.textoMuestra ?? "");
      setAdvertencias(Array.isArray(data.advertencias) ? data.advertencias : []);
    } catch (ex) {
      setErrExtract(ex instanceof Error ? ex.message : "Error");
      setExtractedItems([]);
      setTextoMuestra("");
      setAdvertencias([]);
    } finally {
      setLoadingExtract(false);
    }
  }

  function actualizarItem(index: number, patch: Partial<ItemExtraido>) {
    setExtractedItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function quitarItem(index: number) {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function onImportarLineas() {
    setErrExtract(null);
    setOkImport(null);

    if (!clienteId.trim()) {
      setErrExtract("Seleccione un cliente para importar.");
      return;
    }
    if (!comprobanteImport.trim()) {
      setErrExtract("Indique el número o referencia del comprobante.");
      return;
    }
    if (!archivoIdParaImport.trim()) {
      setErrExtract(
        "Elija el comprobante PDF guardado al que corresponden estas líneas (subalo antes o elija uno de la lista).",
      );
      return;
    }
    const items = extractedItems.filter(
      (i) => i.descripcion.trim() && Number.isFinite(i.cantidad) && i.cantidad > 0,
    );
    if (items.length === 0) {
      setErrExtract("No hay ítems válidos (descripción y cantidad > 0).");
      return;
    }

    setLoadingImport(true);
    try {
      const res = await fetch("/api/importar-comprobante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          clienteId,
          obraId: obraId || null,
          archivoId: archivoIdParaImport.trim(),
          comprobante: comprobanteImport.trim(),
          items: items.map((i) => ({
            codigo: i.codigo.trim() || "-",
            descripcion: i.descripcion.trim(),
            cantidad: i.cantidad,
            ...(i.precioUnitario !== undefined &&
            Number.isFinite(i.precioUnitario) &&
            i.precioUnitario >= 0
              ? { precioUnitario: i.precioUnitario }
              : {}),
          })),
        }),
      });
      const data = (await res.json()) as { error?: string; creados?: number };
      if (!res.ok) throw new Error(data.error ?? "Error al importar");
      setOkImport(`Importados ${data.creados ?? items.length} movimiento(s).`);
    } catch (ex) {
      setErrExtract(ex instanceof Error ? ex.message : "Error");
    } finally {
      setLoadingImport(false);
    }
  }

  const stepsMeta = [
    { n: 1, label: "SELECCIONAR CLIENTE" },
    { n: 2, label: "SELECCIONAR ARCHIVO" },
    { n: 3, label: "ANALISIS E IMPORTACION" },
  ] as const;

  return (
    <div className="space-y-6">
      <nav aria-label="Pasos" className="flex flex-wrap gap-2">
        {stepsMeta.map(({ n, label }) => {
          const active = step === n;
          const done = step > n;
          return (
            <span
              key={n}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                done
                  ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80"
                  : active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              <span className="tabular-nums opacity-80">{n}</span>
              {label}
            </span>
          );
        })}
      </nav>

      <form onSubmit={onSubmit} className="card space-y-6">
        {step === 1 && (
          <div className="card-compact space-y-4 border border-slate-200/80 bg-slate-50/40 p-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Paso 1 · Seleccionar cliente</h2>
              <p className="mt-1 text-xs text-slate-600">
                Elegí cliente y, si aplica, la obra. Después subís el PDF.
              </p>
            </div>
            <div>
              <label className="label-field">Cliente</label>
              <select
                required
                value={clienteId}
                onChange={(e) => {
                  setClienteId(e.target.value);
                  setObraId("");
                }}
                className="select-app"
              >
                <option value="">Seleccionar…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Obra (opcional)</label>
              <select value={obraId} onChange={(e) => setObraId(e.target.value)} className="select-app">
                <option value="">Sin obra</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={!clienteId.trim()}
              onClick={() => setStep(2)}
            >
              Continuar
            </button>
          </div>
        )}

        {step >= 2 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Paso 2 · Seleccionar archivo</h2>
              {!initialClienteId && (
                <button type="button" className="btn-tertiary text-xs h-9" onClick={() => setStep(1)}>
                  ← Cambiar cliente / obra
                </button>
              )}
            </div>
            {step >= 2 && !initialClienteId && (
              <p className="text-xs text-slate-600">
                Cliente:{" "}
                <strong className="text-slate-800">
                  {clientes.find((x) => x.id === clienteId)?.nombre ?? "—"}
                </strong>
                {obraId ? (
                  <>
                    {" "}
                    · Obra:{" "}
                    <strong className="text-slate-800">
                      {obras.find((x) => x.id === obraId)?.nombre ?? "—"}
                    </strong>
                  </>
                ) : (
                  <span className="text-slate-500"> · Sin obra</span>
                )}
              </p>
            )}
            <div>
              <label className="label-field">Archivo(s) PDF</label>
        <div
          role="region"
          aria-label="Zona para arrastrar archivos PDF"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={onPdfDragEnter}
          onDragLeave={onPdfDragLeave}
          onDragOver={onPdfDragOver}
          onDrop={onPdfDrop}
          className={`relative flex min-h-[10rem] cursor-default flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors sm:min-h-[8.5rem] ${
            pdfDragActivo
              ? "border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-400/40"
              : "border-slate-300 bg-slate-50/60 hover:border-slate-400"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Elegir archivos PDF"
            onChange={(e) => {
              setErr(null);
              const list = e.target.files?.length ? Array.from(e.target.files) : [];
              aplicarArchivosPdfElegidos(list);
            }}
          />
          <p className="text-sm font-medium text-slate-800">
            {pdfDragActivo ? "Soltá los PDF acá" : "Arrastrá y soltá los PDF en esta zona"}
          </p>
          <p className="max-w-3xl text-xs text-slate-600">
            O usá el botón para elegirlos desde la carpeta. Podés soltar{" "}
            <strong className="font-medium text-slate-800">varios archivos</strong> a la vez.
          </p>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Elegir desde carpeta
          </button>
        </div>
        {filesSeleccionados.length > 0 && (
          <p className="mt-2 text-xs text-slate-600">
            {filesSeleccionados.length} PDF seleccionado
            {filesSeleccionados.length === 1 ? "" : "s"}:{" "}
            {filesSeleccionados.map((f) => f.name).join(", ")}
          </p>
        )}
              <p className="mt-2 text-xs text-slate-500">
                PDF · varios archivos · cada uno se procesa por separado.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading
                  ? "Subiendo…"
                  : archivosParaSubir().length > 1
                    ? `Subir ${archivosParaSubir().length} PDF`
                    : "Subir PDF"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setStep(3)}
                disabled={!clienteId.trim()}
              >
                Ir a análisis e importación
              </button>
            </div>
            {loading && loadingHint ? (
              <p className="mt-2 text-xs font-medium text-slate-600">{loadingHint}</p>
            ) : null}
          </>
        )}

        {step >= 3 && (
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">Paso 3 · Análisis e importación</h2>
              <button type="button" className="btn-tertiary text-xs h-9" onClick={() => setStep(2)}>
                ← Volver al paso 2
              </button>
            </div>
            {autoImportExitoso && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950 ring-1 ring-emerald-200/60">
                <p className="font-semibold">Importación automática completada.</p>
                <p className="mt-1 text-xs text-emerald-950/80">
                  Como ya se registraron ventas desde el PDF, el análisis manual se oculta para evitar duplicados.
                  Si necesitás revisar o reintentar, podés abrirlo igual.
                </p>
                <button
                  type="button"
                  className="btn-secondary mt-3 text-sm"
                  onClick={() => setMostrarManual((v) => !v)}
                >
                  {mostrarManual ? "Ocultar análisis manual" : "Mostrar análisis manual"}
                </button>
              </div>
            )}
            {extractedItems.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <p className="text-[0.65rem] font-bold uppercase text-slate-500">Comprobantes</p>
                  <p className="font-mono text-lg font-semibold">1</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <p className="text-[0.65rem] font-bold uppercase text-slate-500">Líneas</p>
                  <p className="font-mono text-lg font-semibold">{extractedItems.length}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <p className="text-[0.65rem] font-bold uppercase text-slate-500">Advertencias</p>
                  <p className="font-mono text-lg font-semibold">{advertencias.length}</p>
                </div>
              </div>
            )}
            {mostrarManual && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-800">Extraer y revisar antes de importar</p>
              <p className="text-xs text-slate-600">
                Las ventas quedan ligadas al PDF que elijas. PDF escaneados sin texto no se leen solos.
              </p>
              <p className="text-xs text-emerald-900/80 rounded-lg bg-emerald-50/90 px-3 py-2 ring-1 ring-emerald-200/60">
                <strong className="font-medium">Códigos:</strong> formato{" "}
                <span className="font-mono">MARCA-CÓDIGO - descripción</span> o número al final del
                renglón.
              </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onExtraerPdf()}
            disabled={loadingExtract}
            className="btn-secondary text-sm"
          >
            {loadingExtract ? "Analizando…" : "Analizar PDF e inferir ítems"}
          </button>
          {filesSeleccionados.length > 1 && (
            <span className="text-xs text-slate-500">
              Con varios PDF, el análisis usa solo el primero de la lista.
            </span>
          )}
        </div>
        {extractedItems.length > 0 && archivosPdf.length === 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950">
            Para importar estas líneas, primero <strong className="font-medium">subí el PDF</strong> con el botón
            «Subir PDF» en el paso 2 (así queda guardado en la carpeta del cliente y podés vincularlo). Si ya lo
            subiste
            antes, elegí cliente u obra correctos arriba.
          </p>
        )}
        {extractedItems.length > 0 && archivosPdf.length > 1 && !archivoIdParaImport && (
          <p className="rounded-lg border border-slate-200 bg-slate-100/80 px-3 py-2 text-xs text-slate-700">
            Hay varios PDF guardados: <strong className="font-medium">elegí en la lista</strong> cuál corresponde a
            esta importación.
          </p>
        )}
        {errExtract && (
          <p className="alert-error text-sm" role="alert">
            {errExtract}
          </p>
        )}
        {advertencias.length > 0 && (
          <ul className="list-disc pl-5 text-xs text-amber-800 space-y-1">
            {advertencias.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        )}
        {textoMuestra && (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-600">Vista previa del texto extraído</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white p-2 text-slate-700 whitespace-pre-wrap border border-slate-100">
              {textoMuestra}
            </pre>
          </details>
        )}
        {extractedItems.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div>
              <label className="label-field">PDF guardado (obligatorio para importar)</label>
              <select
                value={archivoIdParaImport}
                onChange={(e) => setArchivoIdParaImport(e.target.value)}
                className="select-app w-full"
              >
                <option value="">Seleccionar comprobante en carpeta del cliente…</option>
                {archivosPdf.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.nombre || "PDF").slice(0, 72)}
                    {" · "}
                    {new Date(a.createdAt).toLocaleString()}
                    {a.obraNombre ? ` · Obra: ${a.obraNombre}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Subí el archivo arriba primero o elegí uno ya guardado. Sin PDF vinculado no se
                registran ventas en cuenta corriente.
              </p>
            </div>
            <label className="label-field">Comprobante (editable)</label>
            <input
              type="text"
              value={comprobanteImport}
              onChange={(e) => setComprobanteImport(e.target.value)}
              className="input-app w-full"
              placeholder="Ej. Factura A 0001-00001234"
            />
            <p className="text-xs text-slate-500">
              Editá las filas o quitá las incorrectas antes de importar. Si el número de comprobante ya fue
              cargado para este cliente, el sistema avisa y no duplica movimientos.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full max-w-full border-collapse text-sm sm:min-w-[36rem] lg:table-fixed lg:min-w-[48rem]">
                <colgroup>
                  <col className="w-[7rem]" />
                  <col />
                  <col className="w-[5.5rem]" />
                  <col className="w-[6.5rem]" />
                  <col className="w-[4rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-600">
                    <th className="px-2 py-2 font-medium">Código</th>
                    <th className="px-2 py-2 font-medium">Descripción</th>
                    <th className="px-2 py-2 font-medium">Cant.</th>
                    <th className="px-2 py-2 font-medium">P. unit.</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {extractedItems.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-50 align-top">
                      <td className="px-2 py-1.5">
                        <input
                          value={row.codigo}
                          onChange={(e) => actualizarItem(idx, { codigo: e.target.value })}
                          className="input-app w-full text-xs py-1.5"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <textarea
                          value={row.descripcion}
                          onChange={(e) => actualizarItem(idx, { descripcion: e.target.value })}
                          rows={2}
                          className="input-app min-h-[3.25rem] w-full resize-y text-xs leading-snug py-2"
                          spellCheck={false}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={row.cantidad}
                          onChange={(e) =>
                            actualizarItem(idx, { cantidad: Number.parseFloat(e.target.value) || 0 })
                          }
                          className="input-app w-full text-xs py-1.5"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={row.precioUnitario ?? ""}
                          placeholder="0"
                          onChange={(e) => {
                            const v = e.target.value;
                            actualizarItem(
                              idx,
                              v === ""
                                ? { precioUnitario: undefined }
                                : {
                                    precioUnitario: Number.parseFloat(v) || 0,
                                  },
                            );
                          }}
                          className="input-app w-full text-xs py-1.5"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => quitarItem(idx)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => void onImportarLineas()}
              disabled={loadingImport}
              className="btn-primary text-sm"
            >
              {loadingImport ? "Importando…" : "Importar como ventas (comprobante)"}
            </button>
            {okImport && (
              <p className="alert-success text-sm" role="status">
                {okImport}
              </p>
            )}
          </div>
        )}
          </div>
        )}

          </div>
        )}

        {err && (
          <p className="alert-error whitespace-pre-line" role="alert">
            {err}
          </p>
        )}
        {ok && (
          <p className="alert-success text-sm" role="status">
            {ok}
          </p>
        )}

        {resultadoSubida && resultadoSubida.length > 0 && (
          <div
            className="space-y-3"
            role="region"
            aria-label="Detalle de importación automática por archivo"
          >
            {resultadoSubida.map((r, ri) => {
              const importacionOk = r.comprobantes.some((c) => c.movimientos > 0);
              const soloAdvertencias = !importacionOk && r.advertencias.length > 0;
              const sinLineasNiAdv =
                !importacionOk && r.advertencias.length === 0 && r.comprobantes.length === 0;
              const dup = textoPareceDuplicadoComprobante(r.advertencias);

              return (
                <div
                  key={`${r.nombre}-${ri}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {r.nombre}
                        {r.total > 1 ? (
                          <span className="ml-1 font-normal text-slate-500">
                            ({r.indice}/{r.total})
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        Guardado en {r.storageEtiqueta}
                        {r.verEn && r.verEn !== "#" ? (
                          <>
                            {" · "}
                            <a
                              href={r.verEn}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                            >
                              Abrir PDF
                            </a>
                          </>
                        ) : null}
                      </p>
                    </div>
                    {importacionOk ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-emerald-900">
                        Importado
                      </span>
                    ) : soloAdvertencias ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-950">
                        Sin líneas nuevas
                      </span>
                    ) : sinLineasNiAdv ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-slate-600">
                        Solo archivo
                      </span>
                    ) : null}
                  </div>

                  {importacionOk && (
                    <ul className="mt-3 space-y-1 text-sm text-emerald-900">
                      {r.comprobantes
                        .filter((c) => c.movimientos > 0)
                        .map((c) => (
                          <li key={c.comprobante} className="flex gap-2">
                            <span className="text-emerald-600" aria-hidden>
                              ✓
                            </span>
                            <span>{resumenComprobanteImportado(c)}</span>
                          </li>
                        ))}
                    </ul>
                  )}

                  {r.advertencias.length > 0 && (
                    <div className={`mt-3 ${importacionOk ? "alert-warning" : "alert-warning ring-1 ring-amber-300/60"}`}>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-900">
                        {dup ? "No se duplicó el comprobante" : "Atención"}
                      </p>
                      <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                        {r.advertencias.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                      {dup && clienteId.trim() ? (
                        <p className="mt-2 text-xs text-amber-900/90">
                          Si querés revisar lo ya cargado, abrí la{" "}
                          <Link
                            href={`/dashboard/clientes/${clienteId}`}
                            className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
                          >
                            cuenta corriente del cliente
                          </Link>
                          .
                        </p>
                      ) : null}
                    </div>
                  )}

                  {sinLineasNiAdv && (
                    <p className="mt-3 text-xs text-slate-600">
                      El archivo quedó en la carpeta del cliente. Si el PDF no tiene texto seleccionable,
                      usá el paso 3 para analizar o cargar ítems a mano.
                    </p>
                  )}

                  {!importacionOk && !soloAdvertencias && r.comprobantes.length > 0 && (
                    <p className="mt-3 text-xs text-slate-600">
                      No se registraron movimientos para los comprobantes detectados; revisá las advertencias
                      de arriba o importá desde el paso 3.
                    </p>
                  )}
                </div>
              );
            })}

            {clienteId.trim() ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/dashboard/clientes/${clienteId}`}
                  className="btn-secondary text-sm"
                >
                  Ver cuenta corriente del cliente
                </Link>
                {obraId.trim() ? (
                  <Link href={`/dashboard/obras/${obraId}`} className="btn-tertiary text-sm h-9">
                    Ir a la obra
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

      </form>
    </div>
  );
}
