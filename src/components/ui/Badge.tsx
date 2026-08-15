import type { ComponentType, ReactNode } from 'react'

// Pill de estado reusable (estados de cotización/reserva/recordatorio,
// fuente de hotel, etc). Reemplaza los pills con emoji embebido por
// texto + ícono lucide opcional, consistentes en toda la app.
export type BadgeTone = 'neutral' | 'warning' | 'info' | 'success' | 'danger' | 'accent' | 'sky' | 'violet'

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-slate-400/20 text-slate-600',
  warning: 'bg-amber-400/20 text-amber-600',
  info: 'bg-blue-400/20 text-blue-600',
  success: 'bg-emerald-400/20 text-emerald-600',
  danger: 'bg-red-400/20 text-red-600',
  accent: 'bg-[var(--accent)]/15 text-[var(--accent-strong)]',
  // Sumados para EstadoBadge (7 estados de EstadoReserva necesitan 7
  // colores distinguibles entre sí, más que los 6 tonos originales).
  sky: 'bg-sky-400/20 text-sky-600',
  violet: 'bg-violet-400/20 text-violet-600',
}

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: BadgeTone
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  )
}
