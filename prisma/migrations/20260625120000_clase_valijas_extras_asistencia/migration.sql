-- Reintegración de atributos del modelo original (clase, equipaje, extras,
-- asistencia especial) + unicidad de email del cliente.

-- CreateEnum
CREATE TYPE "ClaseVuelo" AS ENUM ('ECONOMICA', 'PREMIUM_ECONOMICA', 'EJECUTIVA', 'PRIMERA');

-- AlterTable: cotizaciones — producto aéreo cotizado
ALTER TABLE "cotizaciones" ADD COLUMN "clase" "ClaseVuelo" NOT NULL DEFAULT 'ECONOMICA';
ALTER TABLE "cotizaciones" ADD COLUMN "cantidad_valijas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "cotizaciones" ADD COLUMN "extras" TEXT;
ALTER TABLE "cotizaciones" ADD COLUMN "precio_extras" DECIMAL(12,2);

-- AlterTable: pasajeros — asistencia especial (reintegra `discapacidad`)
ALTER TABLE "pasajeros" ADD COLUMN "asistencia_especial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pasajeros" ADD COLUMN "detalle_asistencia" TEXT;

-- CreateIndex: email único de cliente
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");
