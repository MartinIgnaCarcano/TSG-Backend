// =====================================================
// Tipos para Cotizaciones, reflejando el include de
// Back/TSG-Backend/src/routes/cotizaciones.ts (GET /api/cotizaciones):
//   viaje { origen, destino, tramos }, cliente, hotel
// =====================================================
import type { EstadoCotizacion } from './dashboard'
import type { ClienteCompleto } from './cliente'
import type { ClaseVuelo } from './calculadora'

// Re-exportado: Cotizaciones.tsx lo importa desde acá (no directamente
// desde types/dashboard.ts), así que sin este re-export tsc -b falla con
// TS2459 ("declares 'EstadoCotizacion' locally, but it is not exported").
export type { EstadoCotizacion }

export const CLASE_VUELO_LABEL: Record<ClaseVuelo, string> = {
  ECONOMICA: 'Económica',
  PREMIUM_ECONOMICA: 'Premium Económica',
  EJECUTIVA: 'Ejecutiva',
  PRIMERA: 'Primera',
}

export interface Destino {
  id: string
  codigoIATA: string
  nombre: string
}

export interface Tramo {
  id: string
  orden: number
  horaSalida: string
  horaLlegada: string
  aerolinea: string | null
}

export interface ViajeCompleto {
  id: string
  origen: Destino | null
  destino: Destino | null
  tieneEscalas: boolean
  tramos: Tramo[]
}

export interface Hotel {
  id: string
  nombre: string
  estrellas: number
  precioNoche: number | string
  destino: Destino | null
  baja: string | null
}

export interface CotizacionCompleta {
  id: string
  numeroCotizacion: string
  viajeId: string
  clienteId: string
  fechaVencimiento: string
  moneda: string
  precioIda: number | string
  precioVuelta: number | string
  precioIdaYVuelta: number | string
  impuestos: number | string
  observaciones: string | null
  estado: EstadoCotizacion
  ofertaExternaID: string | null
  clase: ClaseVuelo
  cantidadValijas: number
  extras: string | null
  precioExtras: number | string | null
  hotelId: string | null
  noches: number | null
  precioHotel: number | string | null
  alta: string
  baja: string | null
  viaje: ViajeCompleto
  cliente: ClienteCompleto
  hotel: Hotel | null
}

export type TipoReserva = 'IDA' | 'VUELTA' | 'IDA_Y_VUELTA'
