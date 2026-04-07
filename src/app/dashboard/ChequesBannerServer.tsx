import { getServerUserId } from "@/lib/get-server-user-id";
import { listarChequesVencimientos } from "@/services/vencimientos";
import { redirect } from "next/navigation";
import { ChequesBannerClient } from "./ChequesBannerClient";

export async function ChequesBannerServer() {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");
  const cheques = await listarChequesVencimientos(7);
  return <ChequesBannerClient cheques={cheques} />;
}

