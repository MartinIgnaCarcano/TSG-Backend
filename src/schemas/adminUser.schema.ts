import { z } from 'zod'

// Largo mínimo de contraseña. No es una política de seguridad completa
// (no exige composición ni chequea contraseñas filtradas); es el piso por
// debajo del cual no tiene sentido ni hashear.
const LARGO_MINIMO_PASSWORD = 8

export const crearAdminSchema = z.object({
  email: z.string().trim().email('email inválido'),
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  password: z
    .string()
    .min(LARGO_MINIMO_PASSWORD, `la contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`),
})

export const actualizarAdminSchema = z.object({
  email: z.string().trim().email('email inválido').optional(),
  nombre: z.string().trim().min(1).optional(),
  password: z
    .string()
    .min(LARGO_MINIMO_PASSWORD, `la contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`)
    .optional(),
})

// El login no exige largo mínimo: valida credenciales existentes, no
// crea nuevas. Poner el mínimo acá sólo le contaría al atacante que la
// contraseña que probó era demasiado corta para ser la correcta.
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'email es requerido'),
  password: z.string().min(1, 'password es requerida'),
})
