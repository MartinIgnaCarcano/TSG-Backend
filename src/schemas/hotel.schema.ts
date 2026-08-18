import { z } from 'zod'

// El formulario del front manda los campos vacíos como '' en vez de
// omitirlos, así que una validación de URL a secas rechazaría un alta
// perfectamente válida sin foto. Se acepta la cadena vacía y se guarda
// como null, que es lo que la columna espera.
const urlOpcional = (campo: string) =>
  z
    .union([z.literal(''), z.string().trim().url(`${campo} debe ser una URL válida`)])
    .optional()
    .nullable()
    .transform((v) => v || null)

const ratingOpcional = z
  .union([z.literal(''), z.coerce.number().min(0).max(10)])
  .optional()
  .nullable()
  .transform((v) => (v === '' || v === undefined || v === null ? null : Number(v)))

const hotelBase = z.object({
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  destinoId: z.string().trim().min(1).optional(),
  destinoIATA: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'destinoIATA debe ser de 3 letras')
    .optional(),
  estrellas: z.coerce.number().int().min(1).max(5).optional(),
  precioNoche: z.coerce.number().nonnegative('precioNoche debe ser >= 0'),
  moneda: z.string().trim().min(1).max(10).optional(),
  descripcion: z.string().trim().optional().nullable(),
  direccion: z.string().trim().optional().nullable(),
  urlImagen: urlOpcional('urlImagen'),
  urlReserva: urlOpcional('urlReserva'),
  fuente: z.string().trim().optional(),
  rating: ratingOpcional,
})

// El destino puede llegar por id o por código IATA, pero alguno tiene que
// venir: la ruta ya lo exigía a mano, acá queda declarado.
export const crearHotelSchema = hotelBase.refine((h) => Boolean(h.destinoId || h.destinoIATA), {
  message: 'Falta destinoId o destinoIATA',
  path: ['destinoId'],
})

export const actualizarHotelSchema = hotelBase.partial()
