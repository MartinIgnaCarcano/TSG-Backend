import { z } from 'zod'

export const TIPOS_RECORDATORIO = [
  'PAGO_SALDO',
  'CHECK_IN',
  'POST_VIAJE',
  'CLIMA',
  'VOUCHER',
  'CONTRATO',
] as const

export const crearRecordatorioSchema = z.object({
  reservaId: z.string().min(1, 'reservaId es requerido'),
  tipo: z.enum(TIPOS_RECORDATORIO),
  fechaProgramada: z.coerce.date(),
})

export const ejecutarRecordatorioSchema = z.object({
  resultado: z.string().trim().optional(),
})
