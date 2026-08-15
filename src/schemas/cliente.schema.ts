import { z } from 'zod'

export const crearClienteSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  apellido: z.string().trim().min(1, 'apellido es requerido'),
  telefono: z.string().trim().min(1, 'telefono es requerido'),
  email: z.string().trim().email('email inválido'),
  // Opcional (paridad con el front vanilla): si no se manda, el back genera
  // uno con `CLI-${Date.now()}`. Si se manda vacío, se ignora igual (el POST
  // trata '' como "no vino").
  numeroCliente: z.string().trim().min(1, 'numeroCliente no puede ser vacío').optional(),
})

export const actualizarClienteSchema = crearClienteSchema.partial()
