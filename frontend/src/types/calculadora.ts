// =====================================================
// Tipos para la Calculadora de vuelos. Reflejan lo que devuelve
// POST /api/calculadora/buscar (OpcionVuelo[], ver lib/flights.ts
// del back) más los campos que el front le agrega después de
// resolver origen/destino (Calculadora.js: buscarVuelos()).
// =====================================================

export interface OpcionVuelo {
  aerolinea: string
  precio: number
  escalas: string
  fechaIda: string
  fechaVuelta: string
  noches: number
  etiqueta: string
  esMasBarata?: boolean
  // Agregados en el front al resolver origen/destino (no vienen del back):
  origenIATA: string
  origenNombre: string
  destinoIATA: string
  destinoNombre: string
}

export interface DestinoResuelto {
  id: string
  codigoIATA: string
  nombre: string
}

export type ModoFiltro = 'mejor-precio' | 'sin-escala' | 'precio-bajo' | null

export type ClaseVuelo = 'ECONOMICA' | 'PREMIUM_ECONOMICA' | 'EJECUTIVA' | 'PRIMERA'

export const CLASES_VUELO: { value: ClaseVuelo; label: string }[] = [
  { value: 'ECONOMICA', label: 'Económica' },
  { value: 'PREMIUM_ECONOMICA', label: 'Premium Económica' },
  { value: 'EJECUTIVA', label: 'Ejecutiva' },
  { value: 'PRIMERA', label: 'Primera' },
]

export interface ConfigReserva {
  personas: number
  clase: ClaseVuelo
  cantidadValijas: number
  valijasPrecio: number
  valijasDesc: string
  extraPrecio: number
  extraDesc: string
}

export interface DatosClienteReserva {
  nombre: string
  apellido: string
  email: string
  telefono: string
}

export interface CotizacionCreada {
  id: string
  numeroCotizacion: string
}
