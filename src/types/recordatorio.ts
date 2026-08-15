// =====================================================
// Tipos para Recordatorios, reflejando el include de
// Back/TSG-Backend/src/routes/recordatorios.ts (GET /api/recordatorios):
//   reserva { cliente, cotizacion { viaje { origen, destino } } }
// =====================================================
import type { ClienteCompleto } from './cliente'
import type { Destino } from './cotizacion'

export type TipoRecordatorio = 'PAGO_SALDO' | 'CHECK_IN' | 'POST_VIAJE' | 'CLIMA' | 'VOUCHER'

export interface RecordatorioCompleto {
  id: string
  tipo: TipoRecordatorio
  fechaProgramada: string
  ejecutado: boolean
  fechaEjecucion: string | null
  resultado: string | null
  reserva: {
    numeroReserva: string
    cliente: ClienteCompleto
    cotizacion: {
      viaje: {
        origen: Destino | null
        destino: Destino | null
      }
    } | null
  } | null
}
