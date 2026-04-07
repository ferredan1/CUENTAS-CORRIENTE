import { CargaMovimientoClient } from "./CargaMovimientoClient";

export default async function CargaPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; obraId?: string }>;
}) {
  const { clienteId, obraId } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-slate-200/80 pb-5">
        <h1 className="page-title">Cargar pago</h1>
        <p className="page-subtitle-quiet">
          Registrá cobros del cliente (efectivo, transferencia, tarjeta o cheque). Las ventas se cargan desde «Subir
          PDF».
        </p>
      </header>
      <CargaMovimientoClient initialClienteId={clienteId} initialObraId={obraId} />
    </div>
  );
}
