-- Fase D: conciliación de pagos. Cada pago queda registrado individualmente
-- (medio, fecha, referencia); saldoPagado en reservas se mantiene como
-- cache derivado, ahora respaldado por estos registros.

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADOPAGO', 'OTRO');

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "medio_pago" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "observaciones" TEXT,
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_reserva_id_idx" ON "pagos"("reserva_id");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
