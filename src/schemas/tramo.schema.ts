import { z } from 'zod'

// Campos comunes a un tramo, se usan sueltos (POST /api/tramos) y
// anidados dentro de un viaje (POST /api/viajes).
export const tramoBaseSchema = z.object({
  origenId: z.string().min(1, 'origenId es requerido'),
  destinoId: z.string().min(1, 'destinoId es requerido'),
  orden: z.coerce.number().int().nonnegative().optional(),
  duracionMinutos: z.coerce.number().int().positive().optional(),
  horaSalida: z.coerce.date().optional(),
  horaLlegada: z.coerce.date().optional(),
  aerolinea: z.string().trim().optional().nullable(),
  completo: z.boolean().optional(),
})

export const crearTramoSchema = tramoBaseSchema.extend({
  viajeId: z.string().min(1, 'viajeId es requerido'),
})

export const actualizarTramoSchema = tramoBaseSchema.partial()
