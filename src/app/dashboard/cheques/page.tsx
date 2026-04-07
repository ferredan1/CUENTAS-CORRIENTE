import { getServerUserId } from "@/lib/get-server-user-id";
import { listarCheques } from "@/services/cheques";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChequesClient } from "./ChequesClient";

export default async function ChequesPage() {
  const userId = await getServerUserId();
  if (!userId) redirect("/login");

  const chequesAll = await listarCheques();

  return (
    <Suspense fallback={<p className="page-shell text-sm text-slate-500">Cargando…</p>}>
      <ChequesClient chequesAll={chequesAll} />
    </Suspense>
  );
}
