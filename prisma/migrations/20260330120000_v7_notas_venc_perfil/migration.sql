-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('admin', 'operador');

-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN     "notas" TEXT;

-- AlterTable
ALTER TABLE "MovimientoProveedor" ADD COLUMN     "fechaVencimiento" TIMESTAMP(3),
ADD COLUMN     "notas" TEXT;

-- CreateTable
CREATE TABLE "PerfilUsuario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'operador',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerfilUsuario_userId_key" ON "PerfilUsuario"("userId");

-- CreateIndex
CREATE INDEX "MovimientoProveedor_userId_fechaVencimiento_idx" ON "MovimientoProveedor"("userId", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "MovimientoProveedor_proveedorId_fechaVencimiento_idx" ON "MovimientoProveedor"("proveedorId", "fechaVencimiento");
