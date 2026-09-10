// =====================================================
// Fase M1 (front) — barras de ingresos por mes (últimos 6),
// consume ingresos.porMes de GET /api/estadisticas.
// =====================================================
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ListaVacia } from './ListaCard'
import { fmtMoneda } from '../../lib/format'
import type { IngresoPorMes } from '../../types/estadisticas'

const MESES_ABREV = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

function labelMes({ anio, mes }: { anio: number; mes: number }): string {
  const nombre = MESES_ABREV[mes - 1] ?? String(mes)
  return `${nombre} '${String(anio).slice(-2)}`
}

export function IngresosPorMesChart({ porMes }: { porMes: IngresoPorMes[] }) {
  const hayDatos = porMes.some((m) => m.total > 0)

  if (!hayDatos) {
    return <ListaVacia texto="Sin ingresos registrados en el período" />
  }

  const datos = porMes.map((m) => ({ label: labelMes(m), total: Number(m.total) || 0 }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(v: number) => fmtMoneda(v)}
          />
          <Tooltip
            formatter={(value: number) => [fmtMoneda(value), 'Ingresos']}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
