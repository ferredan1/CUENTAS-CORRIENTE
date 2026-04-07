import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Indica si `dir` es la raíz de este repo (tiene Prisma). */
function isProjectRoot(dir: string): boolean {
  return existsSync(join(dir, "prisma", "schema.prisma"));
}

/**
 * Directorio de trabajo del proceso (p. ej. `next dev`) no siempre coincide con la carpeta del repo
 * (workspace abierto en un padre, monorepos). Buscamos hacia arriba y, si hace falta, entre subdirectorios inmediatos.
 */
export function findProjectRoot(cwd: string = process.cwd()): string {
  let dir = cwd;
  for (let i = 0; i < 16; i++) {
    if (isProjectRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  try {
    const entries = readdirSync(cwd, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const sub = join(cwd, e.name);
      if (isProjectRoot(sub)) return sub;
    }
  } catch {
    // permisos u otro error: seguimos con cwd
  }

  return cwd;
}
