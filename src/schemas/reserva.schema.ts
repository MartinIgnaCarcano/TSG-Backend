import { z } from 'zod'

const montoNoNegativo = z.coerce.number().nonnegative('debe ser un número >= 0')

export const crearReservaSchema = z.object({
  clienteId: z.string().min(1, 'clienteId es requerido'),
  cotizacionId: z.string().min(1, 'cotizacionId es requerido'),
  tipoReserva: z.enum(['IDA', 'VUELTA', 'IDA_Y_VUELTA']),
  montoFinal: montoNoNegativo,
  saldoPagado: montoNoNegativo.optional(),
  observaciones: z.string().trim().optional().nullable(),
  fechaViaje: z.coerce.date().optional(),
  fechaRegreso: z.coerce.date().optional(),
})

export const actualizarReservaSchema = z.object({
  cotizacionId: z.string().min(1).optional(),
  tipoReserva: z.enum(['IDA', 'VUELTA', 'IDA_Y_VUELTA']).optional(),
  montoFinal: montoNoNegativo.optional(),
  saldoPagado: montoNoNegativo.optional(),
  estado: z.enum(['CONFIRMADA', 'CANCELADA', 'EN_PROCESO']).optional(),
  observaciones: z.string().trim().optional().nullable(),
  motivoCancelacion: z.string().trim().optional().nullable(),
})

export const registrarPagoSchema = z.object({
  monto: z.coerce.number().positive('monto debe ser > 0'),
})

export const cancelarReservaSchema = z.object({
  motivo: z.string().trim().optional(),
})
