// =====================================================
// Tipos para GET /api/estadisticas (Fase M1).
// Reflejan 1:1 la forma de res.json(...) en
// Back/TSG-Backend/src/routes/estadisticas.ts — no son el modelo
// Prisma, solo la respuesta agregada que consume el Dashboard.
// =====================================================
import type { EstadoReserva } from './reserva'
import type { MedioPago } from './pago'
import type { TipoDocumento } from './documento'

export interface ReservasPorEstado {
  estado: EstadoReserva
  cantidad: number
}

export interface Conversion {
  periodoDias: number
  totalCotizaciones: number
  cotizacionesAceptadas: number
  tasaConversion: number
}

export interface IngresoPorMes {
  anio: number
  mes: number
  total: number
}

export interface IngresoPorMedioPago {
  medioPago: MedioPago
  total: number
}

export interface Ingresos {
  porMes: IngresoPorMes[]
  porMedioPago: IngresoPorMedioPago[]
}

export interface TopDestino {
  destinoId: string
  nombre: string
  codigoIATA: string
  cantidadCotizaciones: number
}

export interface DocumentoPorTipo {
  tipo: TipoDocumento
  cantidad: number
}

export interface Estadisticas {
  reservasPorEstado: ReservasPorEstado[]
  conversion: Conversion
  ingresos: Ingresos
  topDestinos: TopDestino[]
  documentosPorTipo: DocumentoPorTipo[]
}
