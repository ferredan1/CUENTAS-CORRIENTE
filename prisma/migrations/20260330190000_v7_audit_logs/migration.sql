-- CreateTable
CREATE TABLE "LogCambio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "valorAntes" TEXT NOT NULL,
    "valorDespues" TEXT NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogCambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogEliminacion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "creadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEliminacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogCambio_entidadId_idx" ON "LogCambio"("entidadId");

-- CreateIndex
CREATE INDEX "LogCambio_userId_idx" ON "LogCambio"("userId");

-- CreateIndex
CREATE INDEX "LogCambio_creadoAt_idx" ON "LogCambio"("creadoAt");

-- CreateIndex
CREATE INDEX "LogEliminacion_userId_creadoAt_idx" ON "LogEliminacion"("userId", "creadoAt");

