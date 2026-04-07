import { UploadPdfClient } from "./UploadPdfClient";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; obraId?: string }>;
}) {
  const { clienteId, obraId } = await searchParams;

  return (
    <div className="page-shell space-y-6">
      <header>
        <h1 className="page-title">Subir PDF</h1>
        <p className="page-subtitle max-w-2xl text-slate-500">
          Flujo guiado: seleccionar cliente → seleccionar archivo → análisis e importación de líneas al comprobante.
        </p>
      </header>
      <UploadPdfClient initialClienteId={clienteId} initialObraId={obraId} />
    </div>
  );
}
