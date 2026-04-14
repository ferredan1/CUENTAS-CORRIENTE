import { CargaMovimientoClient } from "./CargaMovimientoClient";

export default async function CargaPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; obraId?: string; tipo?: string }>;
}) {
  const { clienteId, obraId, tipo } = await searchParams;
  const tipoInicial =
    tipo === "devolucion" || tipo === "ajuste" || tipo === "pago" || tipo === "saldo_anterior"
      ? tipo
      : "pago";
  const titulo =
    tipoInicial === "devolucion"
      ? "Cargar devolución"
      : tipoInicial === "ajuste"
        ? "Cargar ajuste"
        : tipoInicial === "saldo_anterior"
          ? "Cargar saldo anterior"
          : "Cargar pago";
  const subtitulo =
    tipoInicial === "devolucion"
      ? "Registrá una devolución manual para que reste del saldo general del cliente."
      : tipoInicial === "ajuste"
        ? "Registrá un ajuste manual (positivo o negativo) para corregir diferencias puntuales."
        : tipoInicial === "saldo_anterior"
          ? "Registrá una deuda previa que el cliente ya tenía antes de usar el sistema (suma al saldo a cobrar)."
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
