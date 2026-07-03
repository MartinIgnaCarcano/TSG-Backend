import { z } from 'zod'
import { MEDIOS_PAGO } from './reserva.schema'

export const crearPagoSchema = z.object({
  reservaId: z.string().min(1, 'reservaId es requerido'),
  monto: z.coerce.number().positive('monto debe ser > 0'),
  medioPago: z.enum(MEDIOS_PAGO).optional().default('OTRO'),
  referencia: z.string().trim().optional().nullable(),
  observaciones: z.string().trim().optional().nullable(),
  fechaPago: z.coerce.date().optional(),
})
