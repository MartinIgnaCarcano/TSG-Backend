import type { ComponentType } from 'react'

// Botón de acción genérico (editar/eliminar/confirmar/etc), reusado en
// las tablas y grids de cada página CRUD. Reemplaza los botones
// emoji-only que había antes por íconos lucide consistentes.
type Variant = 'default' | 'danger' | 'accent' | 'success'

const VARIANT_CLASS: Record<Variant, string> = {
  default:
    'border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]',
  danger: 'border border-[var(--border)] text-red-500 hover:border-red-400 hover:bg-red-500/10',
  accent: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]',
  success: 'border border-green-500/60 bg-green-500/10 text-green-600 hover:bg-green-500/20',
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  disabled,
  type = 'button',
  withLabel = false,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  variant?: Variant
  disabled?: boolean
  type?: 'button' | 'submit'
  /** Si es true, muestra el label al lado del ícono (para botones con texto). */
  withLabel?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS[variant]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {withLabel && <span>{label}</span>}
    </button>
  )
}
