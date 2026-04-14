-- El flag pasa a vivir en `notas` (marcador [cc:no-anticipo-cartera]); se elimina la columna booleana si existía.
DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Movimiento'
      AND column_name = 'excluirDeAnticipoCartera'
  ) THEN
    UPDATE "Movimiento"
    SET "notas" = CASE
      WHEN "notas" IS NULL OR btrim("notas") = '' THEN '[cc:no-anticipo-cartera]'
      ELSE rtrim("notas", E' \t\r\n') || E'\n[cc:no-anticipo-cartera]'
    END
    WHERE "excluirDeAnticipoCartera" IS TRUE
      AND ("notas" IS NULL OR position('[cc:no-anticipo-cartera]' in "notas") = 0);
  END IF;
END
$migrate$;

ALTER TABLE "Movimiento" DROP COLUMN IF EXISTS "excluirDeAnticipoCartera";
