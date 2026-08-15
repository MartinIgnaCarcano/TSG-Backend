// Validación de login en el cliente. El back (POST /api/admin-users/login)
// no tiene un schema Zod propio todavía (no usa validateBody ahí), así que
// esto es la única validación de forma antes de pegarle a la API — igual
// sirve para UX inmediata (no esperar el round-trip para un email vacío).
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'El email es obligatorio').email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
})

export type LoginInput = z.infer<typeof loginSchema>
