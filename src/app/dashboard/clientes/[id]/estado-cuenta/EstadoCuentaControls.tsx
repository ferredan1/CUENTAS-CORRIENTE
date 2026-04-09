"use client";

import { whatsappUrl } from "@/lib/whatsapp";
import { type ReadonlyURLSearchParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function pickDate(sp: URLSearchParams, key: string): string {
  const v = sp.get(key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

function pdfQueryFromSearchParams(sp: ReadonlyURLSearchParams): string {
  const q = new URLSearchParams();
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  const obra = sp.get("obra");
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q.set("desde", desde);
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q.set("hasta", hasta);
  if (obra) q.set("obra", obra);
  return q.toString();
}

function safePdfBaseName(nombre: string): string {
  return nombre
    .replace(/[^\w\s.-]/gi, "_")
    .replace(/\s+/g, "_")
    .slice(0, 48);
}

type ObraOpt = { id: string; nombre: string };
const OBRA_SIN_OBRA = "__sin_obra__";

export function EstadoCuentaControls({
  obras,
  clienteId,
  telefono,
  clienteNombre,
}: {
  obras: ObraOpt[];
  clienteId: string;
  telefono: string | null;
  clienteNombre: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const initial = useMemo(() => {
    const p = new URLSearchParams(sp.toString());
    return {
      desde: pickDate(p, "desde"),
      hasta: pickDate(p, "hasta"),
      obra: p.get("obra") ?? "",
    };
  }, [sp]);

  const [desde, setDesde] = useState(initial.desde);
  const [hasta, setHasta] = useState(initial.hasta);
  const [obra, setObra] = useState(initial.obra);
  const [waBusy, setWaBusy] = useState(false);

  function aplicar() {
    const next = new URLSearchParams(sp.toString());
    if (desde) next.set("desde", desde);
    else next.delete("desde");
    if (hasta) next.set("hasta", hasta);
    else next.delete("hasta");
    if (obra) next.set("obra", obra);
    else next.delete("obra");
    router.push(`${pathname}?${next.toString()}`);
    router.refresh();
  }

  async function enviarPdfWhatsapp() {
    const qs = pdfQueryFromSearchParams(sp);
    const path = `/api/clientes/${encodeURIComponent(clienteId)}/estado-cuenta/pdf${qs ? `?${qs}` : ""}`;
    setWaBusy(true);
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        const errText =
          res.status === 404
            ? "Cliente no encontrado."
            : payload?.error?.trim() || `Error ${res.status}`;
        window.alert(errText);
        return;
      }
      const blob = await res.blob();
      const base = safePdfBaseName(clienteNombre) || "cliente";
      const filename = `estado-cuenta-${base}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });

      const canShareFiles =
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFiles && typeof navigator.share === "function") {
        try {
          await navigator.share({
            files: [file],
            title: "Estado de cuenta",
            text: clienteNombre,
          });
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          downloadBlob(blob, filename);
          openWhatsappFallback();
        }
        return;
      }

      downloadBlob(blob, filename);
      openWhatsappFallback();
    } catch {
      window.alert("No se pudo generar el PDF. Probá de nuevo.");
    } finally {
      setWaBusy(false);
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function openWhatsappFallback() {
    const href = whatsappUrl(telefono);
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="print:hidden rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[min(100%,12rem)] flex-1 sm:flex-none sm:min-w-[12rem]">
            <span className="label-field">Obra</span>
            <select className="select-app" value={obra} onChange={(e) => setObra(e.target.value)}>
              <option value="">Todas</option>
              <option value={OBRA_SIN_OBRA}>Sin obra</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[10rem]">
            <span className="label-field">Desde</span>
            <input type="date" className="input-app" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="min-w-[10rem]">
            <span className="label-field">Hasta</span>
            <input type="date" className="input-app" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <button type="button" className="btn-secondary" onClick={aplicar}>
            Aplicar
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 sm:pt-0 lg:ml-auto lg:border-0 lg:pt-0 dark:border-slate-800">
          <button
            type="button"
            disabled={waBusy}
            className="btn-secondary inline-flex min-h-10 flex-1 items-center justify-center sm:flex-none disabled:opacity-60"
            title={
              telefono
                ? "Genera un PDF y lo comparte (o lo descarga y abre WhatsApp)"
                : "Genera y comparte el PDF; en PC puede descargarse para adjuntarlo a mano"
            }
            onClick={() => void enviarPdfWhatsapp()}
          >
            {waBusy ? "Generando PDF…" : "Enviar por WhatsApp"}
          </button>
          <button
            type="button"
            className="btn-primary inline-flex min-h-10 flex-1 items-center justify-center sm:flex-none"
            onClick={() => window.print()}
          >
            Imprimir / Guardar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
