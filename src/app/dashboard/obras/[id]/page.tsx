import { getServerUserId } from "@/lib/get-server-user-id";
import { obtenerObraConCliente } from "@/services/obras";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ObraVistaClient } from "./ObraVistaClient";

type Props = { params: Promise<{ id: string }> };

export default async function ObraPage({ params }: Props) {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const obra = await obtenerObraConCliente(id);
  if (!obra) notFound();

  const archivos = obra.archivos.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    comprobante: a.comprobante,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="page-shell">
      <nav className="breadcrumb-muted" aria-label="Migas de pan">
        <Link href="/dashboard">Clientes</Link>
        <span aria-hidden>/</span>
        <Link href={`/dashboard/clientes/${obra.clienteId}`}>{obra.clienteNombre}</Link>
        <span aria-hidden>/</span>
        <span className="text-slate-600">{obra.nombre}</span>
      </nav>

      <ObraVistaClient
        obra={{
          id: obra.id,
          nombre: obra.nombre,
          clienteId: obra.clienteId,
          clienteNombre: obra.clienteNombre,
          saldoObra: obra.saldoObra,
          movimientosEnObra: obra.movimientosEnObra,
          comprobantesEnObra: obra.comprobantesEnObra,
        }}
        archivos={archivos}
      />
    </div>
  );
}
