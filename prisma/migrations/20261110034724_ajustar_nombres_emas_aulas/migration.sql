-- Renombrar columnas conservando los datos
ALTER TABLE "emas"
RENAME COLUMN "clave" TO "nombre";

ALTER TABLE "aulas"
RENAME COLUMN "clave" TO "numero";

-- Actualizar los nombres de los índices existentes
ALTER INDEX "emas_clave_key"
RENAME TO "emas_nombre_key";

ALTER INDEX "aulas_ema_id_clave_key"
RENAME TO "aulas_ema_id_numero_key";

-- Preparar la referencia compuesta para los dispositivos
CREATE UNIQUE INDEX "aulas_id_ema_id_key"
ON "aulas"("id", "ema_id");