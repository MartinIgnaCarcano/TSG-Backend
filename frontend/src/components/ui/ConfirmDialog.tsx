import { TriangleAlert } from 'lucide-react'
import { Modal } from './Modal'

// Confirmación reusable para acciones destructivas (baja lógica, etc).
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  mensaje,
  confirmLabel = 'Eliminar',
  titulo = 'Confirmar eliminación',
  pending,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  mensaje: string
  confirmLabel?: string
  titulo?: string
  pending?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={titulo} icon={TriangleAlert}>
      <p className="text-sm text-[var(--text-muted)]">{mensaje}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={pending}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
        >
          {pending ? 'Eliminando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
