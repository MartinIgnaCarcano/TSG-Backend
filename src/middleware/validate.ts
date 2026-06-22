// =====================================================
// Middleware de validación con Zod.
// Se usa así: router.post('/', validateBody(schema), handler).
// Si el body no cumple el schema, responde 400 con el detalle de
// qué campo falló — antes de llegar a Prisma. Si pasa, reemplaza
// req.body por los datos ya parseados/coercionados (ej. strings de
// fecha → Date, strings numéricos → number), así el handler no tiene
// que repetir esas conversiones.
// =====================================================
import { Request, Response, NextFunction } from 'express'
import { ZodIssue, ZodSchema } from 'zod'

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        detalles: result.error.issues.map((i: ZodIssue) => ({
          campo: i.path.join('.') || '(body)',
          mensaje: i.message,
        })),
      })
    }
    req.body = result.data
    next()
  }
}
