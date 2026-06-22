-- AlterTable: agregar hotel opcional a cotizaciones
ALTER TABLE "cotizaciones"
  ADD COLUMN "hotel_id"     TEXT,
  ADD COLUMN "noches"       INTEGER,
  ADD COLUMN "precio_hotel" DECIMAL(12, 2);

-- AddForeignKey
ALTER TABLE "cotizaciones"
  ADD CONSTRAINT "cotizaciones_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hoteles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
