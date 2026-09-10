import type { ReactNode } from 'react'

export function ListaCard({
  titulo,
  badge,
  children,
}: {
  titulo: string
  badge?: number
  children: ReactNode
}) {
  return (
    <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-heading text-base font-bold text-[var(--text)]">{titulo}</h2>
        {badge != null && badge > 0 && (
          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export function ListaItem({ left, right, sub }: { left: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2 text-sm last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-[var(--text)]">{left}</div>
        {sub && <div className="truncate text-xs text-[var(--text-muted)]">{sub}</div>}
      </div>
      {right && <div className="shrink-0 text-right text-[var(--text)]">{right}</div>}
    </div>
  )
}

export function ListaVacia({ texto }: { texto: string }) {
  return <p className="text-sm text-[var(--text-muted)]">{texto}</p>
}
