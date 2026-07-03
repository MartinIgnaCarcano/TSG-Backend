import { z } from 'zod'

const moneda = z.string().trim().min(1).max(10)
const montoNoNegativo = z.coerce.number().nonnegative('debe ser un número >= 0')
const clase = z.enum(['ECONOMICA', 'PREMIUM_ECONOMICA', 'EJECUTIVA', 'PRIMERA'])
const cantidadValijas = z.coerce.number().int().nonnegative('debe ser un entero >= 0')

export const crearCotizacionSchema = z.object({
  viajeId: z.string().min(1, 'viajeId es requerido'),
  clienteId: z.string().min(1, 'clienteId es requerido'),
  fechaVencimiento: z.coerce.date(),
  moneda,
  precioIda: montoNoNegativo,
  precioVuelta: montoNoNegativo,
  precioIdaYVuelta: montoNoNegativo,
  impuestos: montoNoNegativo,
  observaciones: z.string().trim().optional().nullable(),
  ofertaExternaID: z.string().trim().optional().nullable(),
  // Producto aéreo cotizado
  clase: clase.optional(),
  cantidadValijas: cantidadValijas.optional(),
  extras: z.string().trim().optional().nullable(),
  precioExtras: montoNoNegativo.optional().nullable(),
})

export const actualizarCotizacionSchema = z.object({
  fechaVencimiento: z.coerce.date().optional(),
  moneda: moneda.optional(),
  precioIda: montoNoNegativo.optional(),
  precioVuelta: montoNoNegativo.optional(),
  precioIdaYVuelta: montoNoNegativo.optional(),
  impuestos: montoNoNegativo.optional(),
  observaciones: z.string().trim().optional().nullable(),
  estado: z.enum(['PENDIENTE', 'ENVIADA', 'ACEPTADA', 'VENCIDA']).optional(),
  ofertaExternaID: z.string().trim().optional().nullable(),
  hotelId: z.string().trim().optional().nullable(),
  noches: z.coerce.number().int().positive().optional().nullable(),
  precioHotel: montoNoNegativo.optional().nullable(),
  // Producto aéreo cotizado
  clase: clase.optional(),
  cantidadValijas: cantidadValijas.optional(),
  extras: z.string().trim().optional().nullable(),
  precioExtras: montoNoNegativo.optional().nullable(),
})
