import { getServerUserId } from "@/lib/get-server-user-id";
import { listarProveedoresConSaldo } from "@/services/proveedores";
import { redirect } from "next/navigation";
import { ProveedoresClient } from "./ProveedoresClient";

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");

  const { q } = await searchParams;
  const rows = await listarProveedoresConSaldo(q);
  const initialProveedores = rows.map((p) => ({
    ...p,
    ultimoMovimientoFecha: p.ultimoMovimientoFecha?.toISOString() ?? null,
    vencimientoReferencia: p.vencimientoReferencia?.toISOString() ?? null,
  }));

  return <ProveedoresClient initialQ={q?.trim() ?? ""} initialProveedores={initialProveedores} />;
}
