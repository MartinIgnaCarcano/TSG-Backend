// =====================================================
// Tipos para Reservas, reflejando el include de
// Back/TSG-Backend/src/routes/reservas.ts (GET /api/reservas):
//   cliente, cotizacion { viaje { origen, destino, tramos } }
// más saldoPendiente, agregado por conSaldoPendiente() en el back.
// =====================================================
import type { ClienteCompleto } from './cliente'
import type { Destino, Tramo, ViajeCompleto } from './cotizacion'
import type { Pasajero } from './pasajero'
import type { Pago } from './pago'
import type { DocumentoGenerado } from './documento'

// Fase E: máquina de estados ampliada de 3 a 7 pasos. EN_PROCESO → SEÑADA →
// PAGADA → DOCUMENTADA → EN_VIAJE → FINALIZADA, + CANCELADA (terminal desde
// cualquiera). Ver TRANSICIONES_VALIDAS en reservas.service.ts del back.
export type EstadoReserva =
  | 'EN_PROCESO'
  | 'SEÑADA'
  | 'PAGADA'
  | 'DOCUMENTADA'
  | 'EN_VIAJE'
  | 'FINALIZADA'
  | 'CANCELADA'
export type TipoReserva = 'IDA' | 'VUELTA' | 'IDA_Y_VUELTA'

export interface ReservaCompleta {
  id: string
  numeroReserva: string
  clienteId: string
  cotizacionId: string
  tipoReserva: TipoReserva
  estado: EstadoReserva
  montoFinal: number | string
  saldoPagado: number | string
  saldoPendiente: number | string
  observaciones: string | null
  motivoCancelacion: string | null
  fechaViaje: string | null
  fechaRegreso: string | null
  alta: string
  baja: string | null
  cliente: ClienteCompleto
  cotizacion: {
    id: string
    viaje: ViajeCompleto
  } | null
  // Sólo presentes en GET /reservas/:id (detalle) — la lista plana de
  // GET /reservas no los incluye.
  pasajeros?: Pasajero[]
  pagos?: Pago[]
  documentos?: DocumentoGenerado[]
}

export type { Destino, Tramo, ViajeCompleto }
