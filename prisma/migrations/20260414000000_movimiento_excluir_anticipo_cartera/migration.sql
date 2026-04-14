-- Cobro conservado en historial si se borró el PDF; no suma como anticipo en cartera.
ALTER TABLE "Movimiento" ADD COLUMN "excluirDeAnticipoCartera" BOOLEAN NOT NULL DEFAULT false;
