-- ============================================================
-- Esquema DDL — Tesis STG (13 entidades)
-- Generado por concatenación de las migraciones de Prisma.
-- Equivalente a: npx prisma migrate diff --from-empty \
--                  --to-schema-datamodel prisma/schema.prisma --script
-- Fuente canónica: prisma/schema.prisma
-- ============================================================

-- ─────────── 20260527124200_flujos_n8n ───────────
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

-- ─────────── 20260531151755_hoteles ───────────
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

-- ─────────── 20260604000000_add_hotel_to_cotizacion ───────────
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

-- ─────────── 20260623150000_estado_reserva_maquina_estados ───────────
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

-- ─────────── 20260623160000_pasajero_y_documentos_generados ───────────
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

-- ─────────── 20260623170000_pagos ───────────
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

-- ─────────── 20260623180000_recordatorio_contrato ───────────
-- Agrega CONTRATO a TipoRecordatorio: permite que Flujo3_Recordatorios.json
-- dispare la emisión + envío (WhatsApp y email con adjunto) del contrato de
-- forma automática al confirmar la seña (EN_PROCESO -> SEÑADA), análogo a
-- como ya funciona VOUCHER al quedar la reserva PAGADA.

-- AlterEnum
ALTER TYPE "TipoRecordatorio" ADD VALUE 'CONTRATO';

-- ─────────── 20260625120000_clase_valijas_extras_asistencia ───────────
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

