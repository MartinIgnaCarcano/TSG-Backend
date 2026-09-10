import { z } from 'zod'

// Espejo del schema del back (Back/TSG-Backend/src/schemas/cliente.schema.ts)
// para que el form rechace en el cliente lo mismo que rechazaría el server.
export const clienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  apellido: z.string().trim().min(1, 'El apellido es obligatorio'),
  telefono: z.string().trim().min(1, 'El teléfono es obligatorio'),
  email: z.string().trim().email('Email inválido'),
  // Opcional, solo se usa al crear (paridad con Cliente.js vanilla): si se
  // deja vacío, el back genera uno con CLI-<timestamp>.
  numeroCliente: z.string().trim().optional(),
})

export type ClienteInput = z.infer<typeof clienteSchema>
