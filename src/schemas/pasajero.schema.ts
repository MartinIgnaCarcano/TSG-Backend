import { z } from 'zod'

export const crearPasajeroSchema = z.object({
  reservaId: z.string().min(1, 'reservaId es requerido'),
  nombre: z.string().trim().min(1, 'nombre es requerido'),
  apellido: z.string().trim().min(1, 'apellido es requerido'),
  documentoTipo: z.enum(['DNI', 'PASAPORTE']),
  documentoNumero: z.string().trim().min(1, 'documentoNumero es requerido'),
  fechaNacimiento: z.coerce.date(),
  nacionalidad: z.string().trim().optional().nullable(),
  esTitular: z.boolean().optional(),
  asistenciaEspecial: z.boolean().optional(),
  detalleAsistencia: z.string().trim().optional().nullable(),
})

export const actualizarPasajeroSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  apellido: z.string().trim().min(1).optional(),
  documentoTipo: z.enum(['DNI', 'PASAPORTE']).optional(),
  documentoNumero: z.string().trim().min(1).optional(),
  fechaNacimiento: z.coerce.date().optional(),
  nacionalidad: z.string().trim().optional().nullable(),
  esTitular: z.boolean().optional(),
  asistenciaEspecial: z.boolean().optional(),
  detalleAsistencia: z.string().trim().optional().nullable(),
})
