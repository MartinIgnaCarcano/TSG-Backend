-- CreateTable
CREATE TABLE "hoteles" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "destino_id" TEXT NOT NULL,
    "estrellas" INTEGER NOT NULL DEFAULT 3,
    "precio_noche" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "descripcion" TEXT,
    "direccion" TEXT,
    "url_imagen" TEXT,
    "url_reserva" TEXT,
    "fuente" TEXT NOT NULL DEFAULT 'MANUAL',
    "rating" DECIMAL(3,1),
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "hoteles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hoteles_destino_id_baja_idx" ON "hoteles"("destino_id", "baja");

-- AddForeignKey
ALTER TABLE "hoteles" ADD CONSTRAINT "hoteles_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "destinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
