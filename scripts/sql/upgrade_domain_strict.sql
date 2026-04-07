-- Migración manual: schema con String/Float → enums + Decimal + campos nuevos.
-- Pensada para una BD creada con el schema anterior (db push sin migraciones).
--
-- Ejemplo:
--   psql "%DATABASE_URL%" -f scripts/sql/upgrade_domain_strict.sql
--   (o pegar en el cliente SQL de tu herramienta)
--
-- Si ya aplicaste estos cambios, los CREATE TYPE / ALTER … IF EXISTS fallan poco o nada según versión;
-- revisá errores antes de re-ejecutar.

DO $$ BEGIN
  CREATE TYPE "TipoCliente" AS ENUM ('particular', 'constructor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoMovimiento" AS ENUM ('venta', 'pago', 'devolucion', 'ajuste');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MedioPago" AS ENUM ('efectivo', 'transferencia', 'cheque');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ArchivoEstado" AS ENUM ('subido', 'extraido', 'importado', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cliente
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Cliente" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Cliente" ALTER COLUMN "tipo" TYPE "TipoCliente" USING ("tipo"::text::"TipoCliente");

-- Obra
ALTER TABLE "Obra" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Obra_clienteId_nombre_idx" ON "Obra"("clienteId", "nombre");

-- Movimiento
ALTER TABLE "Movimiento" ADD COLUMN IF NOT EXISTS "normalizedComprobante" TEXT;
ALTER TABLE "Movimiento" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Movimiento" SET "medioPago" = NULL WHERE "medioPago" IS NOT NULL AND trim("medioPago"::text) = '';

ALTER TABLE "Movimiento" ALTER COLUMN "tipo" TYPE "TipoMovimiento" USING ("tipo"::text::"TipoMovimiento");

ALTER TABLE "Movimiento" ALTER COLUMN "medioPago" TYPE "MedioPago" USING (
  CASE
    WHEN "medioPago" IS NULL THEN NULL::"MedioPago"
    ELSE trim("medioPago"::text)::"MedioPago"
  END
);

ALTER TABLE "Movimiento" ALTER COLUMN "precioUnitario" SET DATA TYPE DECIMAL(14, 2)
  USING (round(CAST("precioUnitario" AS numeric), 2));
ALTER TABLE "Movimiento" ALTER COLUMN "total" SET DATA TYPE DECIMAL(14, 2)
  USING (round(CAST("total" AS numeric), 2));

CREATE INDEX IF NOT EXISTS "Movimiento_clienteId_fecha_idx" ON "Movimiento"("clienteId", "fecha");
CREATE INDEX IF NOT EXISTS "Movimiento_obraId_fecha_idx" ON "Movimiento"("obraId", "fecha");
CREATE INDEX IF NOT EXISTS "Movimiento_clienteId_tipo_comprobante_idx" ON "Movimiento"("clienteId", "tipo", "comprobante");
CREATE INDEX IF NOT EXISTS "Movimiento_clienteId_normalizedComprobante_idx" ON "Movimiento"("clienteId", "normalizedComprobante");

-- Archivo
ALTER TABLE "Archivo" ADD COLUMN IF NOT EXISTS "estado" "ArchivoEstado" NOT NULL DEFAULT 'subido';
ALTER TABLE "Archivo" ADD COLUMN IF NOT EXISTS "fileHash" TEXT;
ALTER TABLE "Archivo" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Archivo_clienteId_createdAt_idx" ON "Archivo"("clienteId", "createdAt");
