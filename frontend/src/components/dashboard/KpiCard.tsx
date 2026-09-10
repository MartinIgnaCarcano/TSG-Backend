import type { ReactNode } from 'react'

export function KpiCard({
  titulo,
  valor,
  sub,
}: {
  titulo: string
  valor: string | number
  sub?: ReactNode
}) {
  return (
    <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{titulo}</p>
      <p className="mt-1 font-heading text-3xl font-bold tabular-nums text-[var(--text)]">{valor}</p>
      {sub && <div className="mt-1 text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  )
}
