-- Fase B: datos de pasajero (modelo Pasajero, 1-N con Reserva) +
-- documentos generados (voucher/contrato/cotización), reutilizado en Fase C.

-- CreateEnum
CREATE TYPE "TipoDocumentoIdentidad" AS ENUM ('DNI', 'PASAPORTE');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('VOUCHER', 'CONTRATO', 'COTIZACION');

-- CreateTable
CREATE TABLE "pasajeros" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "documento_tipo" "TipoDocumentoIdentidad" NOT NULL,
    "documento_numero" TEXT NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "nacionalidad" TEXT,
    "es_titular" BOOLEAN NOT NULL DEFAULT false,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "pasajeros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pasajeros_reserva_id_idx" ON "pasajeros"("reserva_id");

-- AddForeignKey
ALTER TABLE "pasajeros" ADD CONSTRAINT "pasajeros_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "documentos_generados" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "url" TEXT,
    "hash" TEXT,
    "datos_snapshot" JSONB NOT NULL,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceptado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_aceptacion" TIMESTAMP(3),
    "medio_aceptacion" TEXT,

    CONSTRAINT "documentos_generados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_generados_reserva_id_tipo_idx" ON "documentos_generados"("reserva_id", "tipo");

-- AddForeignKey
ALTER TABLE "documentos_generados" ADD CONSTRAINT "documentos_generados_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
