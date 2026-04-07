-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN "saldoPendiente" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "importeTotal" DECIMAL(14,2) NOT NULL,
    "medioPago" "MedioPago",
    "comprobante" TEXT,
    "observaciones" TEXT,
    "movimientoPagoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacionPago" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "importeAplicado" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AplicacionPago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pago_movimientoPagoId_key" ON "Pago"("movimientoPagoId");

-- CreateIndex
CREATE INDEX "Pago_userId_clienteId_fecha_idx" ON "Pago"("userId", "clienteId", "fecha" DESC);

-- CreateIndex
CREATE INDEX "Pago_userId_createdAt_idx" ON "Pago"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AplicacionPago_pagoId_idx" ON "AplicacionPago"("pagoId");

-- CreateIndex
CREATE INDEX "AplicacionPago_movimientoId_idx" ON "AplicacionPago"("movimientoId");

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_movimientoPagoId_fkey" FOREIGN KEY ("movimientoPagoId") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacionPago" ADD CONSTRAINT "AplicacionPago_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacionPago" ADD CONSTRAINT "AplicacionPago_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "Movimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill saldoPendiente en ventas (usar total, no monto)
UPDATE "Movimiento" SET "saldoPendiente" = "total" WHERE "liquidadoAt" IS NULL AND "tipo" = 'venta';
UPDATE "Movimiento" SET "saldoPendiente" = 0 WHERE "liquidadoAt" IS NOT NULL AND "tipo" = 'venta';
