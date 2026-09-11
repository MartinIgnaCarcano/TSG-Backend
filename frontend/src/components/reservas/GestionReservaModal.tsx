// =====================================================
// Modal "Gestionar reserva": pasajeros (Fase B), historial de pagos
// (Fase D) y documentos — voucher/contrato (Fase B/C) — de una reserva,
// en pestañas dentro del mismo modal. Reemplaza la necesidad de tres
// pantallas separadas: todo lo que el agente necesita para cerrar el
// ciclo operativo de una reserva puntual vive acá.
// =====================================================
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Users,
  Wallet,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Download,
  Check,
  FileSignature,
  BadgeCheck,
} from 'lucide-react'
import { Modal } from '../ui/Modal'
import { IconButton } from '../ui/IconButton'
import { EstadoBadge } from '../ui/EstadoBadge'
import { useReservaDetalle } from '../../hooks/useReservas'
import {
  useCrearPasajero,
  useEliminarPasajero,
} from '../../hooks/usePasajeros'
import { useCrearPago, useEliminarPago } from '../../hooks/usePagos'
import {
  useEmitirVoucher,
  useEmitirContrato,
  useAceptarDocumento,
} from '../../hooks/useDocumentos'
import { fmtMonedaExacta } from '../../lib/format'
import { MEDIOS_PAGO, type MedioPago } from '../../types/pago'
import type { DocumentoTipoPasajero } from '../../types/pasajero'
import type { ApiError } from '../../lib/apiClient'

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

type Tab = 'pasajeros' | 'pagos' | 'documentos'

export function GestionReservaModal({
  reservaId,
  onClose,
}: {
  reservaId: string | null
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('pasajeros')
  const { data: reserva, isLoading } = useReservaDetalle(reservaId ?? undefined)

  if (!reservaId) return null

  return (
    <Modal
      open={!!reservaId}
      onClose={onClose}
      title={
        reserva ? (
          <span className="inline-flex items-center gap-2">
            Gestionar {reserva.numeroReserva} <EstadoBadge estado={reserva.estado} />
          </span>
        ) : (
          'Gestionar reserva'
        )
      }
      icon={Users}
      widthClass="max-w-2xl"
    >
      <div className="mb-4 flex gap-1 border-b border-[var(--border)]">
        <TabButton active={tab === 'pasajeros'} icon={Users} label="Pasajeros" onClick={() => setTab('pasajeros')} />
        <TabButton active={tab === 'pagos'} icon={Wallet} label="Pagos" onClick={() => setTab('pagos')} />
        <TabButton active={tab === 'documentos'} icon={FileText} label="Documentos" onClick={() => setTab('documentos')} />
      </div>

      {isLoading && <p className="text-sm text-[var(--text-muted)]">Cargando…</p>}

      {reserva && tab === 'pasajeros' && <PasajerosTab reservaId={reserva.id} pasajeros={reserva.pasajeros ?? []} />}
      {reserva && tab === 'pagos' && <PagosTab reservaId={reserva.id} reserva={reserva} pagos={reserva.pagos ?? []} />}
      {reserva && tab === 'documentos' && (
        <DocumentosTab reservaId={reserva.id} estado={reserva.estado} documentos={reserva.documentos ?? []} />
      )}
    </Modal>
  )
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof Users
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition ${
        active
          ? 'border-[var(--accent)] text-[var(--accent-strong)]'
          : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

// ----------------------------------------------------- Pasajeros

function PasajerosTab({ reservaId, pasajeros }: { reservaId: string; pasajeros: import('../../types/pasajero').Pasajero[] }) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [documentoTipo, setDocumentoTipo] = useState<DocumentoTipoPasajero>('DNI')
  const [documentoNumero, setDocumentoNumero] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [asistenciaEspecial, setAsistenciaEspecial] = useState(false)
  const [detalleAsistencia, setDetalleAsistencia] = useState('')
  const [error, setError] = useState<string | null>(null)

  const crear = useCrearPasajero()
  const eliminar = useEliminarPasajero()

  async function agregar() {
    if (!nombre.trim() || !apellido.trim() || !documentoNumero.trim() || !fechaNacimiento) {
      setError('Nombre, apellido, N° de documento y fecha de nacimiento son obligatorios.')
      return
    }
    try {
      await crear.mutateAsync({
        reservaId,
        nombre,
        apellido,
        documentoTipo,
        documentoNumero,
        fechaNacimiento,
        asistenciaEspecial,
        detalleAsistencia: asistenciaEspecial ? detalleAsistencia.trim() || null : null,
      })
      setNombre('')
      setApellido('')
      setDocumentoNumero('')
      setFechaNacimiento('')
      setAsistenciaEspecial(false)
      setDetalleAsistencia('')
      setMostrarForm(false)
      setError(null)
    } catch (e) {
      setError((e as ApiError).message || 'No se pudo agregar el pasajero.')
    }
  }

  return (
    <div className="space-y-3">
      {pasajeros.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          No hay pasajeros cargados todavía — son necesarios para emitir voucher o contrato.
        </p>
      )}
      <ul className="space-y-2">
        {pasajeros.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            <div>
              <span className="font-semibold text-[var(--text)]">
                {p.nombre} {p.apellido}
              </span>
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                {p.documentoTipo} {p.documentoNumero}
                {p.esTitular ? ' · titular' : ''}
              </span>
              {p.asistenciaEspecial && (
                <span
                  className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
                  title={p.detalleAsistencia ?? 'Requiere asistencia especial'}
                >
                  ♿ Asistencia
                </span>
              )}
            </div>
            <IconButton
              icon={Trash2}
              label="Quitar"
              variant="danger"
              disabled={eliminar.isPending}
              onClick={() => eliminar.mutate({ id: p.id, reservaId })}
            />
          </li>
        ))}
      </ul>

      {mostrarForm ? (
        <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} />
            <input
              placeholder="Apellido"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={documentoTipo}
              onChange={(e) => setDocumentoTipo(e.target.value as DocumentoTipoPasajero)}
              className={inputClass}
            >
              <option value="DNI">DNI</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
            <input
              placeholder="N° de documento"
              value={documentoNumero}
              onChange={(e) => setDocumentoNumero(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Fecha de nacimiento</label>
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={asistenciaEspecial}
                onChange={(e) => setAsistenciaEspecial(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              />
              ♿ Requiere asistencia especial
            </label>
            {asistenciaEspecial && (
              <input
                placeholder="Detalle (ej: silla de ruedas, movilidad reducida)"
                value={detalleAsistencia}
                onChange={(e) => setDetalleAsistencia(e.target.value)}
                className={inputClass}
              />
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={agregar}
              disabled={crear.isPending}
              className="flex-1 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {crear.isPending ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Agregar pasajero'}
            </button>
            <button
              onClick={() => setMostrarForm(false)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <IconButton icon={Plus} label="Agregar pasajero" variant="accent" withLabel onClick={() => setMostrarForm(true)} />
      )}
    </div>
  )
}

// ----------------------------------------------------- Pagos

function PagosTab({
  reservaId,
  reserva,
  pagos,
}: {
  reservaId: string
  reserva: { montoFinal: number | string; saldoPagado: number | string }
  pagos: import('../../types/pago').Pago[]
}) {
  const [mostrarForm, setMostrarForm] = useState(false)
  const [monto, setMonto] = useState('')
  const [medioPago, setMedioPago] = useState<MedioPago>('OTRO')
  const [referencia, setReferencia] = useState('')
  const [error, setError] = useState<string | null>(null)

  const crear = useCrearPago()
  const eliminar = useEliminarPago()

  const saldoPendiente = Number(reserva.montoFinal) - Number(reserva.saldoPagado)

  async function agregar() {
    const m = parseFloat(monto)
    if (!m || m <= 0) {
      setError('El monto debe ser mayor a 0.')
      return
    }
    try {
      await crear.mutateAsync({ reservaId, monto: m, medioPago, referencia: referencia || undefined })
      toast.success(`Pago de ${fmtMonedaExacta(m)} registrado`)
      setMonto('')
      setReferencia('')
      setMostrarForm(false)
      setError(null)
    } catch (e) {
      const msg = (e as ApiError).message || 'No se pudo registrar el pago.'
      setError(msg)
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-300/40 bg-amber-50/40 px-3 py-2 text-sm">
        Saldo pendiente: <strong className="tabular-nums">{fmtMonedaExacta(saldoPendiente)}</strong>
      </div>

      {pagos.length === 0 && <p className="text-sm text-[var(--text-muted)]">Sin pagos registrados.</p>}
      <ul className="space-y-2">
        {pagos.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            <div>
              <span className="font-semibold tabular-nums text-[var(--text)]">{fmtMonedaExacta(p.monto)}</span>
              <span className="ml-2 text-xs text-[var(--text-muted)]">
                {p.medioPago} {p.referencia ? `· ${p.referencia}` : ''} ·{' '}
                {new Date(p.fechaPago).toLocaleDateString('es-AR')}
              </span>
            </div>
            <IconButton
              icon={Trash2}
              label="Anular"
              variant="danger"
              disabled={eliminar.isPending}
              onClick={() => eliminar.mutate({ id: p.id, reservaId })}
            />
          </li>
        ))}
      </ul>

      {mostrarForm ? (
        <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Monto (USD)"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={inputClass}
            />
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)} className={inputClass}>
              {MEDIOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <input
            placeholder="Referencia (opcional)"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={agregar}
              disabled={crear.isPending}
              className="flex-1 rounded-lg bg-green-500 px-3 py-2 text-sm font-semibold text-black hover:bg-green-600 disabled:opacity-60"
            >
              {crear.isPending ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : 'Registrar pago'}
            </button>
            <button
              onClick={() => setMostrarForm(false)}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <IconButton icon={Plus} label="Registrar pago" variant="success" withLabel onClick={() => setMostrarForm(true)} />
      )}
    </div>
  )
}

// ----------------------------------------------------- Documentos

function DocumentosTab({
  reservaId,
  estado,
  documentos,
}: {
  reservaId: string
  estado: string
  documentos: import('../../types/documento').DocumentoGenerado[]
}) {
  const [error, setError] = useState<string | null>(null)
  const emitirVoucher = useEmitirVoucher()
  const emitirContrato = useEmitirContrato()
  const aceptar = useAceptarDocumento()

  const puedeVoucher = estado === 'PAGADA' || estado === 'DOCUMENTADA'
  const puedeContrato = estado !== 'CANCELADA'

  async function onEmitirVoucher() {
    setError(null)
    try {
      await emitirVoucher.mutateAsync(reservaId)
      toast.success('Voucher emitido')
    } catch (e) {
      const msg = (e as ApiError).message || 'No se pudo emitir el voucher.'
      setError(msg)
      toast.error(msg)
    }
  }

  async function onEmitirContrato() {
    setError(null)
    try {
      await emitirContrato.mutateAsync(reservaId)
      toast.success('Contrato emitido')
    } catch (e) {
      const msg = (e as ApiError).message || 'No se pudo emitir el contrato.'
      setError(msg)
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={onEmitirVoucher}
          disabled={!puedeVoucher || emitirVoucher.isPending}
          title={!puedeVoucher ? 'La reserva debe estar PAGADA para emitir el voucher' : undefined}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {emitirVoucher.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Emitir voucher
        </button>
        <button
          onClick={onEmitirContrato}
          disabled={!puedeContrato || emitirContrato.isPending}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {emitirContrato.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSignature className="h-3.5 w-3.5" />
          )}
          Emitir contrato
        </button>
      </div>
      {!puedeVoucher && (
        <p className="text-xs text-[var(--text-muted)]">
          El voucher requiere que la reserva esté en estado PAGADA (o ya DOCUMENTADA, para reemitir) y con pasajeros
          cargados.
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {documentos.length === 0 && <p className="text-sm text-[var(--text-muted)]">No hay documentos emitidos.</p>}
      <ul className="space-y-2">
        {documentos.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            <div>
              <span className="font-semibold text-[var(--text)]">
                {d.tipo === 'VOUCHER' ? 'Voucher' : 'Contrato'} v{d.version}
              </span>
              {d.aceptado && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                  <BadgeCheck className="h-3 w-3" /> Aceptado
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {/* El back ya filtra los documentos sin archivo, pero el
                  render no depende de eso: si `url` viene nulo se muestra
                  el estado en vez de romper la pantalla entera. */}
              {d.url ? (
                <a
                  href={d.url.startsWith('http') ? d.url : `${import.meta.env.VITE_API_BASE?.replace(/\/api\/?$/, '') ?? ''}${d.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--text)] hover:border-[var(--accent)]"
                >
                  <Download className="h-3 w-3" /> Ver
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
                  Generando…
                </span>
              )}
              {d.tipo === 'CONTRATO' && !d.aceptado && (
                <IconButton
                  icon={Check}
                  label="Marcar aceptado"
                  variant="success"
                  disabled={aceptar.isPending}
                  onClick={() => aceptar.mutate({ id: d.id, reservaId, medio: 'panel' })}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
