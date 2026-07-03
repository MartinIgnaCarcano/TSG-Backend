-- Agrega CONTRATO a TipoRecordatorio: permite que Flujo3_Recordatorios.json
-- dispare la emisión + envío (WhatsApp y email con adjunto) del contrato de
-- forma automática al confirmar la seña (EN_PROCESO -> SEÑADA), análogo a
-- como ya funciona VOUCHER al quedar la reserva PAGADA.

-- AlterEnum
ALTER TYPE "TipoRecordatorio" ADD VALUE 'CONTRATO';
