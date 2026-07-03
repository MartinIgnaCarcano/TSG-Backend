import { z } from 'zod'

export const aceptarDocumentoSchema = z.object({
  medio: z.string().trim().min(1, 'medio es requerido').optional(),
})
