import { z } from 'zod'

export const actualizarParametroSchema = z.object({
  // La tabla guarda texto; se acepta número o booleano y se normaliza,
  // que es lo que hacía la ruta con String(valor).
  valor: z.union([z.string(), z.number(), z.boolean()]).transform(String),
  descripcion: z.string().trim().optional().nullable(),
})
