import type { ComponentType, ReactNode } from 'react'
import { X } from 'lucide-react'

// Modal genérico (backdrop + caja), reusado por todas las páginas CRUD.
// Cierra al click en el backdrop, igual que el comportamiento de los
// modales del front vanilla. El icon ahora es un componente lucide
// (no un emoji string) para mantener una estética consistente.
export function Modal({
  open,
  onClose,
  title,
  icon: Icon,
  children,
  widthClass = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  // ReactNode (no solo string) para poder sumar un EstadoBadge u otro
  // adorno al lado del título (ver GestionReservaModal).
  title: ReactNode
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
  widthClass?: string
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`w-full ${widthClass} rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-soft`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-[var(--text)]">
            {Icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent-strong)]">
                <Icon className="h-4 w-4" />
              </span>
            )}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] transition hover:bg-[var(--border)] hover:text-[var(--text)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
