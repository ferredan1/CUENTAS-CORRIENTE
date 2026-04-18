/** Unifica saltos de línea y espacios raros del motor PDF (evita que el parser falle en silencio). */
export function normalizarTextoExtraidoPdf(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    /** NBSP, narrow NBSP, figure/thin/punctuation space (común entre columnas en PDF). */
    .replace(/[\u00A0\u202F\u2007\u2009\u2008\u200A\u2000-\u2006]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

export async function extraerTextoDePdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default as (
    b: Buffer,
  ) => Promise<{ text?: string }>;
  const data = await pdfParse(buffer);
  const raw = typeof data.text === "string" ? data.text : "";
  return normalizarTextoExtraidoPdf(raw);
}
