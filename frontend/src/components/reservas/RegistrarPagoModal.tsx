// =====================================================
// Modal "Registrar pago", portado de Reservas.js
// (abrirPago / registrarPago): registra un pago parcial o total
// contra el saldo pendiente de la reserva (PATCH /reservas/:id/pago,
// atómico en el back vía increment).
// =====================================================
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Wallet, Loader2, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useRegistrarPago } from '../../hooks/useReservas'
import { fmtMonedaExacta } from '../../lib/format'
import type { ReservaCompleta } from '../../types/reserva'
import type { ApiError } from '../../lib/apiClient'

export function RegistrarPagoModal({
  reserva,
  onClose,
}: {
  reserva: ReservaCompleta | null
  onClose: () => void
}) {
  const [monto, setMonto] = useState('')
  const [error, setError] = useState<string | null>(null)

  const registrarPago = useRegistrarPago()

  const saldoPendiente = reserva
    ? Number(reserva.saldoPendiente ?? Number(reserva.montoFinal) - Number(reserva.saldoPagado || 0))
    : 0

  useEffect(() => {
    if (!reserva) return
    setMonto(saldoPendiente.toFixed(2))
    setError(null)
    // saldoPendiente se recalcula a partir de reserva, no hace falta en deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserva])

  if (!reserva) return null

  async function confirmar() {
    if (!reserva) return
    const monto2 = parseFloat(monto)
    if (!monto2 || monto2 <= 0) {
      setError('El monto debe ser mayor a 0')
      return
    }
    try {
      await registrarPago.mutateAsync({ id: reserva.id, monto: monto2 })
      toast.success(`Pago de ${fmtMonedaExacta(monto2)} registrado en ${reserva.numeroReserva}`)
      onClose()
    } catch (e) {
      const msg = (e as ApiError).message || 'No se pudo registrar el pago.'
      setError(msg)
      toast.error(msg)
    }
  }

  return (
    <Modal open={!!reserva} onClose={onClose} title="Registrar pago" icon={Wallet} widthClass="max-w-sm">
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Reserva <strong className="text-[var(--accent)]">{reserva.numeroReserva}</strong>
      </p>

      <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-50/40 px-4 py-3">
        <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Saldo pendiente</div>
        <div className="mt-0.5 font-heading text-xl font-extrabold tabular-nums text-amber-500">
          {fmtMonedaExacta(saldoPendiente)}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Monto a abonar (USD)</label>
        <input
          type="number"
          step="0.01"
          min={0}
          max={saldoPendiente}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">Podés registrar un pago parcial o total.</p>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={confirmar}
          disabled={registrarPago.isPending}
          className="flex-1 rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-green-600 disabled:opacity-60"
        >
          {registrarPago.isPending ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Registrar pago
            </span>
          )}
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
