import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  STORAGE_SEGMENT,
  buildClienteComprobantePdfFileName,
} from "@/lib/storage/object-paths";

export type LocalUploadResult = {
  /** Ruta bajo /public, p. ej. /uploads/clientes/{clienteId}/….pdf */
  publicPath: string;
};

export async function saveUploadLocal(params: {
  buffer: Buffer;
  clienteId: string;
  originalName: string;
}): Promise<LocalUploadResult> {
  const fileName = buildClienteComprobantePdfFileName(params.originalName);
  const base = join(process.cwd(), "public", "uploads", STORAGE_SEGMENT.clientes, params.clienteId);
  await mkdir(base, { recursive: true });
  const absolute = join(base, fileName);
  await writeFile(absolute, params.buffer);
  const publicPath = `/uploads/${STORAGE_SEGMENT.clientes}/${params.clienteId}/${fileName}`;
  return { publicPath };
}
