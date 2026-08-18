import { z } from 'zod'

const codigoIATA = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'codigoIATA debe ser de 3 letras')
  .transform((s) => s.toUpperCase())

export const crearDestinoSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  codigoIATA,
  pais: z.string().trim().min(1, 'pais es requerido'),
  timezone: z.string().trim().min(1).optional(),
})

export const actualizarDestinoSchema = crearDestinoSchema.partial()
