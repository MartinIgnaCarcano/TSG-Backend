import { z } from 'zod'
import { tramoBaseSchema } from './tramo.schema'

export const crearViajeSchema = z.object({
  origenId: z.string().min(1, 'origenId es requerido'),
  destinoId: z.string().min(1, 'destinoId es requerido'),
  // `tieneEscalas` no acepta coerción a propósito: con `z.coerce.boolean()`
  // el string "false" se convierte en `true`, que es justo el error que la
  // validación tiene que evitar.
  tieneEscalas: z.boolean().optional().default(false),
  descripcion: z.string().trim().optional().nullable(),
  tramos: z.array(tramoBaseSchema).optional(),
})

export const actualizarViajeSchema = z.object({
  origenId: z.string().min(1).optional(),
  destinoId: z.string().min(1).optional(),
  tieneEscalas: z.boolean().optional(),
  descripcion: z.string().trim().optional().nullable(),
})
