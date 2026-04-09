import { CargaMovimientoClient } from "./CargaMovimientoClient";

export default async function CargaPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; obraId?: string; tipo?: string }>;
}) {
  const { clienteId, obraId, tipo } = await searchParams;
  const tipoInicial =
    tipo === "devolucion" || tipo === "ajuste" || tipo === "pago" ? tipo : "pago";
  const titulo =
    tipoInicial === "devolucion"
      ? "Cargar devolución"
      : tipoInicial === "ajuste"
        ? "Cargar ajuste"
        : "Cargar pago";
  const subtitulo =
    tipoInicial === "devolucion"
      ? "Registrá una devolución manual para que reste del saldo general del cliente."
      : tipoInicial === "ajuste"
        ? "Registrá un ajuste manual (positivo o negativo) para corregir saldo anterior."
        : "Registrá cobros del cliente (efectivo, transferencia, tarjeta o cheque). Las ventas se cargan desde «Subir PDF».";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="border-b border-slate-200/80 pb-5">
        <h1 className="page-title">{titulo}</h1>
        <p className="page-subtitle-quiet">{subtitulo}</p>
      </header>
      <CargaMovimientoClient
        initialClienteId={clienteId}
        initialObraId={obraId}
        initialTipo={tipoInicial}
      />
    </div>
  );
}
