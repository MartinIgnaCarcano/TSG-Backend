import { z } from 'zod'

export const crearClienteSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  apellido: z.string().trim().min(1, 'apellido es requerido'),
  telefono: z.string().trim().min(1, 'telefono es requerido'),
  email: z.string().trim().email('email inválido'),
})

export const actualizarClienteSchema = crearClienteSchema.partial()
