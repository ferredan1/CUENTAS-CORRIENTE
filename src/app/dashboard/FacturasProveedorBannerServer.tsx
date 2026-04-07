import { getServerUserId } from "@/lib/get-server-user-id";
import { listarFacturasProveedorVencimientos } from "@/services/vencimientos";
import { redirect } from "next/navigation";
import { FacturasProveedorBannerClient } from "./FacturasProveedorBannerClient";

export async function FacturasProveedorBannerServer() {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");
  const rows = await listarFacturasProveedorVencimientos(3);
  return <FacturasProveedorBannerClient items={rows} />;
}
