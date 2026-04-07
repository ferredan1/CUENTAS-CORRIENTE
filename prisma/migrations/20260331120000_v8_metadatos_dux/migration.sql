-- Add metadata fields for Dux/AFIP comprobantes on Archivo
ALTER TABLE "Archivo"
ADD COLUMN     "letra" TEXT,
ADD COLUMN     "cae" TEXT,
ADD COLUMN     "caeFechaVto" TIMESTAMP(3),
ADD COLUMN     "cuitCliente" TEXT;

