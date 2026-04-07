import { config, parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findProjectRoot } from "@/lib/project-root";

let applied = false;

function hasPrismaSchema(dir: string): boolean {
  return existsSync(join(dir, "prisma", "schema.prisma"));
}

/**
 * `findProjectRoot()` usa `cwd` (y next.config/prisma.config lo comparten).
 * En el servidor con Turbopack el bundle vive bajo `.next/...`; subiendo desde *este* archivo
 * igual encontramos `prisma/schema.prisma` aunque el cwd no sea la carpeta del repo.
 */
function projectRoot(): string {
  const fromCwd = findProjectRoot();
  if (hasPrismaSchema(fromCwd)) return fromCwd;

  try {
    let d = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 28; i++) {
      if (hasPrismaSchema(d)) return d;
      const parent = dirname(d);
      if (parent === d) break;
      d = parent;
    }
  } catch {
    // import.meta no disponible o ruta inválida
  }

  return fromCwd;
}

/** Fuerza .env del proyecto sobre variables del sistema (p. ej. DATABASE_URL vieja en Windows). */
export function loadProjectEnv(): void {
  if (process.env.NODE_ENV !== "production") {
    const root = projectRoot();
    config({ path: join(root, ".env"), override: true });
    const localPath = join(root, ".env.local");
    if (existsSync(localPath)) {
      config({ path: localPath, override: true });
    }
    return;
  }
  if (applied) return;
  applied = true;
  config({ path: resolve(projectRoot(), ".env"), override: true });
}

/** Fuera de producción, priorizamos DATABASE_URL leída del disco (Turbopack a veces no setea NODE_ENV=development). */
function databaseUrlFromEnvFile(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  try {
    const root = projectRoot();
    const merged: Record<string, string> = {};
    const envMain = join(root, ".env");
    const envLocal = join(root, ".env.local");
    if (existsSync(envMain)) {
      Object.assign(merged, parse(readFileSync(envMain, "utf8")));
    }
    if (existsSync(envLocal)) {
      Object.assign(merged, parse(readFileSync(envLocal, "utf8")));
    }
    return merged.DATABASE_URL?.trim();
  } catch {
    return undefined;
  }
}

export function getDatabaseUrl(): string {
  loadProjectEnv();
  /** En dev, la URL del archivo .env manda sobre variables del sistema (p. ej. DATABASE_URL vieja en Windows). */
  let url =
    databaseUrlFromEnvFile() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_URL?.trim();

  if (!url) {
    throw new Error(
      "No está definida la URL de Postgres. Seteá `DATABASE_URL` (o en Vercel `POSTGRES_PRISMA_URL` / `POSTGRES_URL`).",
    );
  }

  // Si vamos a configurar TLS desde `pg` (PG_SSL_CA / PG_SSL_NO_VERIFY), evitamos que `sslmode=...`
  // en la cadena tome control y fuerce verify-full con CA inexistente.
  const wantsPgSsl =
    Boolean(process.env.PG_SSL_CA?.trim()) ||
    ["1", "true"].includes((process.env.PG_SSL_NO_VERIFY ?? "").trim().toLowerCase());

  if (wantsPgSsl) {
    try {
      const u = new URL(url);
      u.searchParams.delete("sslmode");
      u.searchParams.delete("sslrootcert");
      u.searchParams.delete("sslcert");
      u.searchParams.delete("sslkey");
      url = u.toString();
    } catch {
      // Si no parsea como URL (p. ej. formatos raros), no tocamos.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    process.env.DATABASE_URL = url;
  }

  return url;
}
