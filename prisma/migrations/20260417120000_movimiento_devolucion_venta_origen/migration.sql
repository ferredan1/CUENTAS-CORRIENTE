-- Devoluciones vinculadas a una venta: el importe ya está en saldoPendiente de la venta; este FK evita doble resta en cartera.
ALTER TABLE "Movimiento" ADD COLUMN "devolucionVentaOrigenId" TEXT;

ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_devolucionVentaOrigenId_fkey"
  FOREIGN KEY ("devolucionVentaOrigenId") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Movimiento_devolucionVentaOrigenId_idx" ON "Movimiento"("devolucionVentaOrigenId");

-- Heurística: devoluciones con mismo cliente, obra y comprobante que una venta (patrón de registrarDevolucionSobreVenta).
UPDATE "Movimiento" AS d
SET "devolucionVentaOrigenId" = v.id
FROM "Movimiento" AS v
WHERE d."tipo" = 'devolucion'
  AND d."devolucionVentaOrigenId" IS NULL
  AND v."tipo" = 'venta'
  AND v."clienteId" = d."clienteId"
  AND v."obraId" IS NOT DISTINCT FROM d."obraId"
  AND v."comprobante" IS NOT DISTINCT FROM d."comprobante"
  AND d."descripcion" LIKE 'Devolución%';
