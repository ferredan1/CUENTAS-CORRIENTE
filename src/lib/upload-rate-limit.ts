const uploadHits = new Map<string, number[]>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOADS = 10;

/**
 * Limita subidas por sujeto de sesión (p. ej. id de Supabase Auth), no por entidad de negocio.
 * Best effort en serverless (memoria no compartida entre instancias).
 */
export function checkUploadRateLimit(sessionSubjectId: string): boolean {
  const now = Date.now();
  const arr = (uploadHits.get(sessionSubjectId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_UPLOADS) return false;
  arr.push(now);
  uploadHits.set(sessionSubjectId, arr);
  return true;
}
