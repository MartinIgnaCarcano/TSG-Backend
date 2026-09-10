import { Hourglass, Wallet, CircleDollarSign, FileCheck2, PlaneTakeoff, CircleCheckBig, XCircle } from 'lucide-react'
import { Badge, type BadgeTone } from './Badge'
import type { EstadoReserva } from '../../types/reserva'

// Componente único para el color/label/ícono de EstadoReserva (Fase E, 7
// pasos), consolidado acá para no repetir el mapeo estado→color en cada
// página (antes vivía duplicado, y con distinta cantidad de estados, en
// Reservas.tsx, GestionReservaModal.tsx y Dashboard.tsx — este último
// todavía tenía el mapeo viejo de 3 estados de antes de la Fase E).
const ESTADO_INFO: Record<EstadoReserva, { label: string; tone: BadgeTone; icon: typeof Hourglass }> = {
  EN_PROCESO: { label: 'En proceso', tone: 'warning', icon: Hourglass },
  SEÑADA: { label: 'Señada', tone: 'sky', icon: Wallet },
  PAGADA: { label: 'Pagada', tone: 'success', icon: CircleDollarSign },
  DOCUMENTADA: { label: 'Documentada', tone: 'violet', icon: FileCheck2 },
  EN_VIAJE: { label: 'En viaje', tone: 'info', icon: PlaneTakeoff },
  FINALIZADA: { label: 'Finalizada', tone: 'neutral', icon: CircleCheckBig },
  CANCELADA: { label: 'Cancelada', tone: 'danger', icon: XCircle },
}

export function EstadoBadge({ estado }: { estado: EstadoReserva | string }) {
  const info = ESTADO_INFO[estado as EstadoReserva] ?? { label: estado, tone: 'neutral' as BadgeTone, icon: undefined }
  return (
    <Badge tone={info.tone} icon={info.icon}>
      {info.label}
    </Badge>
  )
}
