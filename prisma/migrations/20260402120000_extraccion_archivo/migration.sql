-- CreateTable
CREATE TABLE "ExtraccionArchivo" (
    "id" TEXT NOT NULL,
    "archivoId" TEXT NOT NULL,
    "intento" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL,
    "textoExtraido" TEXT,
    "jsonExtraido" JSONB,
    "confianza" DOUBLE PRECISION,
    "errores" TEXT,
    "versionParser" TEXT,
    "revisadoManualmente" BOOLEAN NOT NULL DEFAULT false,
    "revisadoPor" TEXT,
    "importadoComoMovId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraccionArchivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtraccionArchivo_archivoId_idx" ON "ExtraccionArchivo"("archivoId");

-- CreateIndex
CREATE INDEX "ExtraccionArchivo_estado_createdAt_idx" ON "ExtraccionArchivo"("estado", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ExtraccionArchivo" ADD CONSTRAINT "ExtraccionArchivo_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "Archivo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
