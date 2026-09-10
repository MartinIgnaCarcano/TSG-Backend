// =====================================================
// Modal "Editar reserva", portado de Reservas.js
// (abrirEditarReserva / guardarEdicionReserva): permite ajustar
// monto final, tipo y estado de una reserva existente.
// =====================================================
import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useActualizarReserva } from '../../hooks/useReservas'
import type { ReservaCompleta, EstadoReserva, TipoReserva } from '../../types/reserva'
import type { ApiError } from '../../lib/apiClient'

export function EditarReservaModal({
  reserva,
  onClose,
}: {
  reserva: ReservaCompleta | null
  onClose: () => void
}) {
  const [monto, setMonto] = useState('')
  const [tipo, setTipo] = useState<TipoReserva>('IDA_Y_VUELTA')
  const [estado, setEstado] = useState<EstadoReserva>('EN_PROCESO')
  const [error, setError] = useState<string | null>(null)

  const actualizar = useActualizarReserva()

  useEffect(() => {
    if (!reserva) return
    setMonto(String(reserva.montoFinal ?? ''))
    setTipo(reserva.tipoReserva || 'IDA_Y_VUELTA')
    setEstado(reserva.estado || 'EN_PROCESO')
    setError(null)
  }, [reserva])

  if (!reserva) return null

  async function guardar() {
    if (!reserva) return
    const montoFinal = parseFloat(monto)
    if (Number.isNaN(montoFinal) || montoFinal < 0) {
      setError('El monto tiene que ser un número >= 0.')
      return
    }
    try {
      await actualizar.mutateAsync({ id: reserva.id, input: { montoFinal, tipoReserva: tipo, estado } })
      onClose()
    } catch (e) {
      setError((e as ApiError).message || 'No se pudo guardar la reserva.')
    }
  }

  return (
    <Modal
      open={!!reserva}
      onClose={onClose}
      title={`Editar Reserva ${reserva.numeroReserva || reserva.id.slice(0, 8)}`}
      icon={Pencil}
    >
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Monto Final (USD)</label>
          <input
            type="number"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoReserva)}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="IDA">Solo ida</option>
            <option value="VUELTA">Solo vuelta</option>
            <option value="IDA_Y_VUELTA">Ida y vuelta</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Estado</label>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoReserva)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          <option value="EN_PROCESO">En proceso</option>
          <option value="SEÑADA">Señada</option>
          <option value="PAGADA">Pagada</option>
          <option value="DOCUMENTADA">Documentada</option>
          <option value="EN_VIAJE">En viaje</option>
          <option value="FINALIZADA">Finalizada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          El back valida la transición contra la máquina de estados — un salto inválido (ej: EN_PROCESO →
          DOCUMENTADA) devuelve error y no se guarda.
        </p>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={guardar}
          disabled={actualizar.isPending}
          className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
        >
          {actualizar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          onClick={onClose}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
