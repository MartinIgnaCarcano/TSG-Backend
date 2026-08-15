// =====================================================
// Tipos para Pago (Fase D), reflejando el modelo Prisma `Pago`.
// Registro auditable de cada cobro — saldoPagado en Reserva sigue siendo
// el cache que usa el resto del front, esto es el detalle por movimiento.
// =====================================================
export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'MERCADOPAGO' | 'OTRO'

export interface Pago {
  id: string
  reservaId: string
  monto: number | string
  medioPago: MedioPago
  referencia: string | null
  observaciones: string | null
  fechaPago: string
  alta: string
  baja: string | null
}

export interface PagoInput {
  reservaId: string
  monto: number
  medioPago?: MedioPago
  referencia?: string
  observaciones?: string
}

export const MEDIOS_PAGO: { value: MedioPago; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago' },
  { value: 'OTRO', label: 'Otro' },
]
