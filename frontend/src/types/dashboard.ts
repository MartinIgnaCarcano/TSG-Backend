// =====================================================
// Tipos mínimos para los datos que consume el Dashboard.
// Reflejan la forma "array plano" que devuelven los endpoints
// cuando no se pasa ?page/?pageSize (modo compat n8n/front, ver
// Back/TSG-Backend/src/routes/*.ts). No son el modelo Prisma
// completo, solo los campos que el Dashboard efectivamente usa.
// =====================================================
import type { EstadoReserva as EstadoReservaCompleto } from './reserva'

export interface Destino {
  codigoIATA: string
  nombre: string
}

export interface Viaje {
  origen?: Destino | null
  destino?: Destino | null
}

export interface Cliente {
  id: string
  nombre: string
  apellido: string
  email?: string | null
}

export type EstadoCotizacion = 'PENDIENTE' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA'

export interface Cotizacion {
  id: string
  numeroCotizacion: string
  estado: EstadoCotizacion
  precioIdaYVuelta: number | string
  cliente?: Cliente | null
  viaje?: Viaje | null
}

// Antes redefinido acá como 'EN_PROCESO' | 'CONFIRMADA' | 'CANCELADA' — se
// había quedado desactualizado desde que la Fase E amplió la máquina de
// estados a 7 pasos. Reexportado desde types/reserva.ts para que no se
// vuelva a desincronizar.
export type EstadoReserva = EstadoReservaCompleto

export interface Reserva {
  id: string
  numeroReserva: string
  estado: EstadoReserva
  montoFinal: number | string
  saldoPagado?: number | string
  alta: string
  cliente?: Cliente | null
  cotizacion?: {
    viaje?: Viaje | null
  } | null
}

export interface Parametro {
  clave: string
  valor: string
  descripcion?: string | null
}

export type TipoRecordatorio = 'PAGO_SALDO' | 'CHECK_IN' | 'POST_VIAJE' | 'CLIMA' | 'VOUCHER'

export interface Recordatorio {
  id: string
  tipo: TipoRecordatorio
  ejecutado: boolean
  fechaProgramada: string
  reserva?: {
    numeroReserva: string
    cliente?: Cliente | null
  } | null
}
