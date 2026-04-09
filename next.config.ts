import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";
import { findProjectRoot } from "./src/lib/project-root";

// Sobrescribe variables de entorno del sistema con el .env del proyecto (p. ej. DATABASE_URL en Windows).
const projectRoot = findProjectRoot();
loadEnv({ path: join(projectRoot, ".env"), override: true });
const envLocal = join(projectRoot, ".env.local");
if (existsSync(envLocal)) {
  loadEnv({ path: envLocal, override: true });
}

const nextConfig: NextConfig = {
  // Asegura que el middleware (Edge) vea el mismo valor que el servidor Node para modo local.
  env: {
    AUTH_BYPASS_LOCAL: process.env.AUTH_BYPASS_LOCAL ?? "",
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "prisma",
    "pdf-parse",
    "pdfkit",
  ],
  outputFileTracingIncludes: {
    "/api/clientes/[id]/estado-cuenta/pdf/route": [
      "./node_modules/pdfkit/js/data/**",
      "./node_modules/pdfkit/js/**",
      "./node_modules/fontkit/**",
      "./node_modules/linebreak/**",
    ],
  },
};

export default nextConfig;
