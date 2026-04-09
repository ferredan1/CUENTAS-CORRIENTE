"use client";

import { BorrarComprobanteButton } from "@/app/dashboard/clientes/[id]/BorrarComprobanteButton";
import { etiquetaArchivoConComprobante, formatFechaCorta } from "@/lib/format";
import Link from "next/link";
import { BorrarObraButton } from "@/components/BorrarObraButton";
import { ObraMovimientosClient } from "./ObraMovimientosClient";

type ArchivoRow = {
  id: string;
  nombre: string | null;
  comprobante: string | null;
  createdAt: string;
};

type Props = {
  obra: {
    id: string;
    nombre: string;
    clienteId: string;
    clienteNombre: string;
    saldoObra: number;
    movimientosEnObra: number;
    comprobantesEnObra: number;
  };
  archivos: ArchivoRow[];
};

export function ObraVistaClient({ obra, archivos }: Props) {
  return (
    <>
      <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">{obra.nombre}</h1>
          <p className="mt-1.5 text-xs text-slate-600">
            Cliente:{" "}
            <Link
              href={`/dashboard/clientes/${obra.clienteId}`}
              className="font-medium text-emerald-800 hover:underline"
            >
              {obra.clienteNombre}
            </Link>
            <span className="mx-1.5 text-slate-300">·</span>
            {obra.movimientosEnObra} mov.
            <span className="mx-1.5 text-slate-300">·</span>
            {obra.comprobantesEnObra} PDF
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/upload?clienteId=${obra.clienteId}&obraId=${obra.id}`}
            className="btn-secondary"
          >
            Subir PDF
          </Link>
          <Link
            href={`/dashboard/carga?clienteId=${obra.clienteId}&obraId=${obra.id}`}
            className="btn-primary"
          >
            Registrar cobro
          </Link>
          <div className="ml-1 border-l border-slate-200 pl-2">
            <BorrarObraButton obraId={obra.id} nombre={obra.nombre} clienteId={obra.clienteId} />
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div className="section-header border-0 pb-0">
          <h2 className="section-title">Comprobantes en esta obra</h2>
          <span className="section-count">{archivos.length}</span>
        </div>
        <div className="table-shell">
          <table className="table-app w-full max-w-full min-w-[min(100%,32rem)] sm:min-w-[560px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Archivo</th>
                <th className="w-24">Ver</th>
                <th className="w-24"> </th>
              </tr>
            </thead>
            <tbody>
              {archivos.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-slate-600">{formatFechaCorta(a.createdAt)}</td>
                  <td
                    className="max-w-[min(100%,28rem)] truncate font-medium text-slate-800"
                    title={etiquetaArchivoConComprobante(a.nombre, a.comprobante)}
                  >
                    {etiquetaArchivoConComprobante(a.nombre, a.comprobante)}
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
                    <BorrarComprobanteButton archivoId={a.id} />
                  </td>
                </tr>
              ))}
              {archivos.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500">
                    Sin comprobantes en esta obra. Usá «Subir PDF» para cargar uno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ObraMovimientosClient obraId={obra.id} clienteId={obra.clienteId} saldoObra={obra.saldoObra} />
    </>
  );
}
