// =====================================================
// Fase M1 (front) — funnel/barras horizontales de reservas por
// EstadoReserva (7 pasos de Fase E), consume reservasPorEstado de
// GET /api/estadisticas. Paleta alineada con ESTADO_BADGE de
// src/pages/Reservas.tsx (mismo criterio de color por estado).
// =====================================================
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ListaVacia } from './ListaCard'
import type { ReservasPorEstado } from '../../types/estadisticas'
import type { EstadoReserva } from '../../types/reserva'

const ESTADO_LABEL: Record<EstadoReserva, string> = {
  EN_PROCESO: 'En proceso',
  SEÑADA: 'Señada',
  PAGADA: 'Pagada',
  DOCUMENTADA: 'Documentada',
  EN_VIAJE: 'En viaje',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
}

const ESTADO_COLOR: Record<EstadoReserva, string> = {
  EN_PROCESO: '#ca8a04',
  SEÑADA: '#0284c7',
  PAGADA: '#059669',
  DOCUMENTADA: '#7c3aed',
  EN_VIAJE: '#2563eb',
  FINALIZADA: '#64748b',
  CANCELADA: '#dc2626',
}

export function ReservasPorEstadoChart({ reservasPorEstado }: { reservasPorEstado: ReservasPorEstado[] }) {
  const hayDatos = reservasPorEstado.some((r) => r.cantidad > 0)

  if (!hayDatos) {
    return <ListaVacia texto="Todavía no hay reservas cargadas" />
  }

  const datos = reservasPorEstado.map((r) => ({
    estado: r.estado,
    label: ESTADO_LABEL[r.estado] ?? r.estado,
    cantidad: r.cantidad,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={90}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [value, 'Reservas']}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
            {datos.map((d) => (
              <Cell key={d.estado} fill={ESTADO_COLOR[d.estado]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
