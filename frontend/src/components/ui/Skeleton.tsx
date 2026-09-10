// Skeleton genérico (pulso) + variante para filas de tabla, usados en el
// isLoading de TanStack Query en vez del texto "Cargando…" plano.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--border)] ${className}`} />
}

// `cols` puede tener anchos distintos por columna (ej. la primera más
// angosta, tipo "# Reserva") — si no se pasa, todas usan el mismo ancho.
export function SkeletonTableRows({
  rows = 5,
  cols,
}: {
  rows?: number
  cols: number | { count: number; widths?: string[] }
}) {
  const count = typeof cols === 'number' ? cols : cols.count
  const widths = typeof cols === 'number' ? undefined : cols.widths

  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
          {Array.from({ length: count }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className={`h-4 ${widths?.[j] ?? 'w-24'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
