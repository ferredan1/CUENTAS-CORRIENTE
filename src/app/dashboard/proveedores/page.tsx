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
  const proveedores = await listarProveedoresConSaldo(q);

  return <ProveedoresClient initialQ={q?.trim() ?? ""} initialProveedores={proveedores} />;
}
