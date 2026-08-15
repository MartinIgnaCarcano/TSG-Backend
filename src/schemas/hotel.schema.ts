import { z } from 'zod'

// Espejo de las validaciones manuales del back
// (Back/TSG-Backend/src/routes/hoteles.ts: POST exige nombre + precioNoche + destinoId).
export const hotelSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  destinoId: z.string().trim().min(1, 'Elegí un destino'),
  estrellas: z.coerce.number().int().min(1).max(5),
  precioNoche: z.coerce.number().positive('El precio debe ser mayor a 0'),
  rating: z.union([z.coerce.number().min(0).max(10), z.literal('')]).optional(),
  descripcion: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  urlImagen: z.string().trim().optional(),
  urlReserva: z.string().trim().optional(),
})

export type HotelInput = z.infer<typeof hotelSchema>

export const buscarFlujo6Schema = z.object({
  ciudad: z.string().trim().min(1, 'Completá la ciudad'),
  checkin: z.string().trim().min(1, 'Completá el check-in'),
  checkout: z.string().trim().min(1, 'Completá el check-out'),
  adults: z.coerce.number().int().min(1).default(2),
  rooms: z.coerce.number().int().min(1).default(1),
  estrellas: z.string().optional(),
  precioMax: z.union([z.coerce.number().positive(), z.literal('')]).optional(),
})

export type BuscarFlujo6Input = z.infer<typeof buscarFlujo6Schema>
