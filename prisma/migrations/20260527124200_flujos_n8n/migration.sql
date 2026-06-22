-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('PENDIENTE', 'ENVIADA', 'ACEPTADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoReserva" AS ENUM ('IDA', 'VUELTA', 'IDA_Y_VUELTA');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'CANCELADA', 'EN_PROCESO');

-- CreateEnum
CREATE TYPE "TipoRecordatorio" AS ENUM ('PAGO_SALDO', 'CHECK_IN', 'POST_VIAJE', 'CLIMA', 'VOUCHER');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "numero_cliente" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo_iata" TEXT NOT NULL,
    "pais" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "destinos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viajes" (
    "id" TEXT NOT NULL,
    "origen_id" TEXT NOT NULL,
    "destino_id" TEXT NOT NULL,
    "tiene_escalas" BOOLEAN NOT NULL,
    "descripcion" TEXT,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "viajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tramos" (
    "id" TEXT NOT NULL,
    "viaje_id" TEXT NOT NULL,
    "origen_id" TEXT NOT NULL,
    "destino_id" TEXT NOT NULL,
    "completo" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER,
    "duracion_minutos" INTEGER,
    "hora_salida" TIMESTAMP(3),
    "hora_llegada" TIMESTAMP(3),
    "aerolinea" TEXT,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "tramos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotizaciones" (
    "id" TEXT NOT NULL,
    "viaje_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "numero_cotizacion" TEXT NOT NULL,
    "estado" "EstadoCotizacion" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_cotizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" DATE NOT NULL,
    "moneda" TEXT NOT NULL,
    "oferta_externa_id" TEXT,
    "precio_ida" DECIMAL(12,2) NOT NULL,
    "precio_vuelta" DECIMAL(12,2) NOT NULL,
    "precio_ida_y_vuelta" DECIMAL(12,2) NOT NULL,
    "impuestos" DECIMAL(12,2) NOT NULL,
    "observaciones" TEXT,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "cotizaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "cotizacion_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "tipoReserva" "TipoReserva" NOT NULL,
    "monto_final" DECIMAL(12,2) NOT NULL,
    "saldo_pagado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_viaje" TIMESTAMP(3),
    "fecha_regreso" TIMESTAMP(3),
    "numero_reserva" TEXT NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'EN_PROCESO',
    "motivo_cancelacion" TEXT,
    "fecha_reserva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,
    "baja" TIMESTAMP(3),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordatorios" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "tipo" "TipoRecordatorio" NOT NULL,
    "fecha_programada" TIMESTAMP(3) NOT NULL,
    "ejecutado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_ejecucion" TIMESTAMP(3),
    "resultado" TEXT,
    "alta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recordatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros_sistema" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "modificacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parametros_sistema_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_numero_cliente_key" ON "clientes"("numero_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "destinos_codigo_iata_key" ON "destinos"("codigo_iata");

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_numero_cotizacion_key" ON "cotizaciones"("numero_cotizacion");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_numero_reserva_key" ON "reservas"("numero_reserva");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "recordatorios_fecha_programada_ejecutado_idx" ON "recordatorios"("fecha_programada", "ejecutado");

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_origen_id_fkey" FOREIGN KEY ("origen_id") REFERENCES "destinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viajes" ADD CONSTRAINT "viajes_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "destinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos" ADD CONSTRAINT "tramos_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos" ADD CONSTRAINT "tramos_origen_id_fkey" FOREIGN KEY ("origen_id") REFERENCES "destinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tramos" ADD CONSTRAINT "tramos_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "destinos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viajes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cotizacion_id_fkey" FOREIGN KEY ("cotizacion_id") REFERENCES "cotizaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios" ADD CONSTRAINT "recordatorios_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
