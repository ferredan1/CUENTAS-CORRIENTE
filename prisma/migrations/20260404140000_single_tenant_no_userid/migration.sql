-- Single-tenant: elimina userId de negocio, PerfilUsuario y RolUsuario.
-- Proyecto sin datos a preservar: migración destructiva explícita.

-- Perfil y enum de roles
DROP TABLE IF EXISTS "PerfilUsuario";
DROP TYPE IF EXISTS "RolUsuario";

-- Índices que incluyen columnas a eliminar
DROP INDEX IF EXISTS "Cliente_userId_idx";
DROP INDEX IF EXISTS "Pago_userId_clienteId_fecha_idx";
DROP INDEX IF EXISTS "Pago_userId_createdAt_idx";
DROP INDEX IF EXISTS "Proveedor_userId_idx";
DROP INDEX IF EXISTS "Proveedor_userId_nombre_idx";
DROP INDEX IF EXISTS "MovimientoProveedor_userId_idx";
DROP INDEX IF EXISTS "MovimientoProveedor_userId_fechaVencimiento_idx";
DROP INDEX IF EXISTS "LogCambio_userId_idx";
DROP INDEX IF EXISTS "LogEliminacion_userId_creadoAt_idx";

-- Columnas userId
ALTER TABLE "Cliente" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "Pago" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "Proveedor" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "MovimientoProveedor" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "ArchivoProveedor" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "LogCambio" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "LogEliminacion" DROP COLUMN IF EXISTS "userId";

-- Índices nuevos (alineados a schema Prisma)
CREATE INDEX IF NOT EXISTS "Pago_clienteId_fecha_idx" ON "Pago"("clienteId", "fecha" DESC);
CREATE INDEX IF NOT EXISTS "Pago_createdAt_idx" ON "Pago"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Proveedor_nombre_idx" ON "Proveedor"("nombre");

CREATE INDEX IF NOT EXISTS "LogEliminacion_creadoAt_idx" ON "LogEliminacion"("creadoAt");
