import { z } from 'zod'

const montoNoNegativo = z.coerce.number().nonnegative('debe ser un número >= 0')

export const ESTADOS_RESERVA = [
  'EN_PROCESO',
  'SEÑADA',
  'PAGADA',
  'DOCUMENTADA',
  'EN_VIAJE',
  'FINALIZADA',
  'CANCELADA',
] as const

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

// Hallazgo A-4 de la auditoría de ingeniería: `saldoPagado` ya no se
// puede escribir por acá. Era la única vía que movía el saldo sin dejar
// un `Pago` que lo respaldara, y rompía el invariante de la Fase D
// (`saldoPagado = SUM(pagos activos)`) justo en la plata, que es lo que
// después imprime el contrato. Para corregir un saldo hay que registrar
// un pago (POST /api/pagos) o anular el mal cargado (DELETE
// /api/pagos/:id), que es para lo que existe `anularPago`.
export const actualizarReservaSchema = z.object({
  cotizacionId: z.string().min(1).optional(),
  tipoReserva: z.enum(['IDA', 'VUELTA', 'IDA_Y_VUELTA']).optional(),
  montoFinal: montoNoNegativo.optional(),
  estado: z.enum(ESTADOS_RESERVA).optional(),
  observaciones: z.string().trim().optional().nullable(),
  motivoCancelacion: z.string().trim().optional().nullable(),
})

export const actualizarEstadoSchema = z.object({
  estado: z.enum(ESTADOS_RESERVA),
  motivo: z.string().trim().optional(),
})

export const MEDIOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADOPAGO', 'OTRO'] as const

export const registrarPagoSchema = z.object({
  monto: z.coerce.number().positive('monto debe ser > 0'),
  // Opcionales para no romper a n8n/integraciones viejas que sólo mandan
  // `monto` — si no vienen, el pago queda igual auditado con medio OTRO.
  medioPago: z.enum(MEDIOS_PAGO).optional().default('OTRO'),
  referencia: z.string().trim().optional().nullable(),
  observaciones: z.string().trim().optional().nullable(),
})

export const cancelarReservaSchema = z.object({
  motivo: z.string().trim().optional(),
})
