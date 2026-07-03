-- Fase E: máquina de estados explícita de Reserva.
-- EstadoReserva pasa de (EN_PROCESO, CONFIRMADA, CANCELADA) a
-- (EN_PROCESO, SEÑADA, PAGADA, DOCUMENTADA, EN_VIAJE, FINALIZADA, CANCELADA).
--
-- Mapeo de datos existentes:
--   EN_PROCESO -> EN_PROCESO (sin cambio)
--   CANCELADA  -> CANCELADA (sin cambio)
--   CONFIRMADA -> PAGADA si (monto_final - saldo_pagado) <= 0, si no SEÑADA
--
-- Patrón estándar de Postgres para cambiar un enum usado en una columna:
-- crear el tipo nuevo, migrar la columna con USING + CASE, y reemplazar el tipo viejo.

BEGIN;

-- 1) Tipo nuevo
CREATE TYPE "EstadoReserva_new" AS ENUM ('EN_PROCESO', 'SEÑADA', 'PAGADA', 'DOCUMENTADA', 'EN_VIAJE', 'FINALIZADA', 'CANCELADA');

-- 2) Quitar default antes de cambiar el tipo de la columna
ALTER TABLE "reservas" ALTER COLUMN "estado" DROP DEFAULT;

-- 3) Migrar los datos existentes con el mapeo
ALTER TABLE "reservas"
  ALTER COLUMN "estado" TYPE "EstadoReserva_new"
  USING (
    CASE "estado"::text
      WHEN 'EN_PROCESO' THEN 'EN_PROCESO'
      WHEN 'CANCELADA' THEN 'CANCELADA'
      WHEN 'CONFIRMADA' THEN (
        CASE WHEN ("monto_final" - "saldo_pagado") <= 0 THEN 'PAGADA' ELSE 'SEÑADA' END
      )
      ELSE 'EN_PROCESO'
    END
  )::"EstadoReserva_new";

-- 4) Reemplazar el tipo viejo por el nuevo
ALTER TYPE "EstadoReserva" RENAME TO "EstadoReserva_old";
ALTER TYPE "EstadoReserva_new" RENAME TO "EstadoReserva";
DROP TYPE "EstadoReserva_old";

-- 5) Restaurar el default
ALTER TABLE "reservas" ALTER COLUMN "estado" SET DEFAULT 'EN_PROCESO';

COMMIT;
