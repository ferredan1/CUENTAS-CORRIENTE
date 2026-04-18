-- Pagos y devoluciones deben guardarse como importes positivos; el signo contable lo da el tipo.
-- Corrige filas históricas con total/precio negativos para que el saldo y los listados coincidan con la lógica actual.
UPDATE "Movimiento"
SET
  "total" = ABS("total"),
  "precioUnitario" = ABS("precioUnitario"),
  "updatedAt" = NOW()
WHERE "tipo" IN ('pago', 'devolucion')
  AND ("total" < 0 OR "precioUnitario" < 0);
