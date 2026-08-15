// =====================================================
// Modal "Confirmar reserva" — convierte una cotización PENDIENTE en
// una Reserva. Paridad con Cotizaciones.js: abrirConfirmar/confirmarReserva.
// Flujo: 1) POST /reservas (cliente+cotizacion+tipo+monto), 2) PUT
// /cotizaciones/:id { estado: 'ACEPTADA' }.
// =====================================================
import { useEffect, useState } from 'react'
import { CircleCheck, PlaneTakeoff, Building2, DollarSign, Hotel } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { fmtMonedaExacta } from '../../lib/format'
import type { CotizacionCompleta, TipoReserva } from '../../types/cotizacion'
import { useCrearReserva } from '../../hooks/useReservas'
import { useActualizarCotizacion } from '../../hooks/useCotizaciones'
import type { ApiError } from '../../lib/apiClient'

export function ConfirmarReservaModal({
  cotizacion,
  onClose,
  onConfirmada,
}: {
  cotizacion: CotizacionCompleta | null
  onClose: () => void
  onConfirmada: (numeroReserva: string) => void
}) {
  const [tipo, setTipo] = useState<TipoReserva>('IDA_Y_VUELTA')
  const [monto, setMonto] = useState('')
  const [obs, setObs] = useState('')
  const [error, setError] = useState<string | null>(null)

  const crearReserva = useCrearReserva()
  const actualizarCotizacion = useActualizarCotizacion()
  const pending = crearReserva.isPending || actualizarCotizacion.isPending

  const totalVuelo = cotizacion ? Number(cotizacion.precioIdaYVuelta || 0) + Number(cotizacion.impuestos || 0) : 0
  const totalHotel = cotizacion ? Number(cotizacion.precioHotel || 0) : 0
  const total = totalVuelo + totalHotel

  useEffect(() => {
    if (!cotizacion) return
    setTipo('IDA_Y_VUELTA')
    setMonto(total.toFixed(2))
    setObs('')
    setError(null)
    // total se recalcula a partir de cotizacion, no hace falta en deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotizacion])

  if (!cotizacion) return null

  const cli = cotizacion.cliente
  const v = cotizacion.viaje
  const ruta =
    v?.origen?.codigoIATA && v?.destino?.codigoIATA ? `${v.origen.codigoIATA} → ${v.destino.codigoIATA}` : '–'

  async function confirmar() {
    if (!cotizacion) return
    const montoFinal = parseFloat(monto)
    if (Number.isNaN(montoFinal) || montoFinal <= 0) {
      setError('El monto final tiene que ser mayor a 0.')
      return
    }
    setError(null)
    try {
      const { data: reserva } = await crearReserva.mutateAsync({
        clienteId: cotizacion.clienteId,
        cotizacionId: cotizacion.id,
        tipoReserva: tipo,
        montoFinal,
        observaciones: obs.trim() || undefined,
      })
      await actualizarCotizacion.mutateAsync({ id: cotizacion.id, input: { estado: 'ACEPTADA' } })
      onConfirmada(reserva.numeroReserva)
    } catch (e) {
      setError((e as ApiError).message || 'No se pudo confirmar la reserva')
    }
  }

  return (
    <Modal open={!!cotizacion} onClose={onClose} title="Confirmar reserva" icon={CircleCheck} widthClass="max-w-lg">
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Vas a convertir esta cotización en una <strong>reserva confirmada</strong>. La cotización pasará a estado{' '}
        <code>ACEPTADA</code>.
      </p>

      <div className="mb-4 rounded-lg bg-[var(--bg)] p-3 text-sm text-[var(--text)]">
        <div>
          <strong>
            {cli.nombre} {cli.apellido}
          </strong>{' '}
          · {cli.email}
        </div>
        <div className="mt-1 flex items-center gap-1">
          <PlaneTakeoff className="h-3.5 w-3.5 text-[var(--text-muted)]" /> {ruta} ·{' '}
          <Building2 className="h-3.5 w-3.5 text-[var(--text-muted)]" /> {v?.tramos?.[0]?.aerolinea || '–'}
        </div>
        <div className="mt-1 flex items-center gap-1">
          <DollarSign className="h-3.5 w-3.5 text-[var(--text-muted)]" /> Sub: {fmtMonedaExacta(cotizacion.precioIdaYVuelta)} ·
          Imp: {fmtMonedaExacta(cotizacion.impuestos)}
        </div>
        {cotizacion.hotel && (
          <div className="mt-1 flex items-center gap-1">
            <Hotel className="h-3.5 w-3.5 text-[var(--text-muted)]" /> {cotizacion.hotel.nombre} · {cotizacion.noches}{' '}
            noches · {fmtMonedaExacta(cotizacion.precioHotel)}
          </div>
        )}
        <div className="mt-1 text-base font-bold">Total: {fmtMonedaExacta(total)}</div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Tipo de reserva</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoReserva)}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="IDA_Y_VUELTA">Ida y vuelta</option>
            <option value="IDA">Solo ida</option>
            <option value="VUELTA">Solo vuelta</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Monto final (USD)</label>
          <input
            type="number"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Observaciones (opcional)</label>
          <textarea
            rows={2}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirmar}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            {pending ? 'Confirmando…' : 'Confirmar reserva'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
