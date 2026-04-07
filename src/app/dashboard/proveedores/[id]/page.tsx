import { getServerUserId } from "@/lib/get-server-user-id";
import { redirect } from "next/navigation";
import { obtenerProveedor } from "@/services/proveedores";
import { ProveedorFichaClient } from "./ProveedorFichaClient";
import type { ProveedorDTO } from "./proveedor-ficha-types";

export default async function ProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");
  const { id } = await params;
  const p = await obtenerProveedor(id);
  if (!p) redirect("/dashboard/proveedores");
  return <ProveedorFichaClient proveedor={p as unknown as ProveedorDTO} />;
}

