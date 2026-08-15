// =====================================================
// Tipos para Pasajero (Fase B), reflejando
// Back/TSG-Backend/src/schemas/pasajero.schema.ts y el modelo Prisma.
// Un Pasajero es 1-N con Reserva (grupo familiar, cada uno con su propio
// documento) — separado de Cliente, que es el contacto/titular de la cuenta.
// =====================================================
export type DocumentoTipoPasajero = 'DNI' | 'PASAPORTE'

export interface Pasajero {
  id: string
  reservaId: string
  nombre: string
  apellido: string
  documentoTipo: DocumentoTipoPasajero
  documentoNumero: string
  fechaNacimiento: string | null
  nacionalidad: string | null
  esTitular: boolean
  asistenciaEspecial: boolean
  detalleAsistencia: string | null
  alta: string
  baja: string | null
}

export interface PasajeroInput {
  reservaId: string
  nombre: string
  apellido: string
  documentoTipo: DocumentoTipoPasajero
  documentoNumero: string
  fechaNacimiento?: string
  nacionalidad?: string
  esTitular?: boolean
  asistenciaEspecial?: boolean
  detalleAsistencia?: string | null
}
