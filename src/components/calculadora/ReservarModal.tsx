// =====================================================
// Modal "Crear cotización" de la Calculadora, portado de
// Calculadora.js (abrirModalReserva / confirmarReservaCalculadora).
// Pide datos del cliente y dispara useCrearCotizacionDesdeVuelo.
// =====================================================
import { useState } from 'react'
import { Ticket, Calendar, Mail, Phone, Loader2, Check } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useCrearCotizacionDesdeVuelo } from '../../hooks/useCalculadora'
import type { ApiError } from '../../lib/apiClient'
import { CLASES_VUELO, type ConfigReserva, type OpcionVuelo } from '../../types/calculadora'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

export function ReservarModal({
  opcion,
  config,
  totalUSD,
  onClose,
  onCreada,
}: {
  opcion: OpcionVuelo | null
  config: ConfigReserva
  totalUSD: number
  onClose: () => void
  onCreada: (numeroCotizacion: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState<string | null>(null)

  const crear = useCrearCotizacionDesdeVuelo()

  if (!opcion) return null

  async function onConfirmar() {
    if (!opcion) return
    setError(null)
    const n = nombre.trim()
    const a = apellido.trim()
    const e = email.trim().toLowerCase()
    const t = telefono.trim()

    if (!n || !a) {
      setError('Completá nombre y apellido.')
      return
    }
    if (!EMAIL_RE.test(e)) {
      setError('Email inválido.')
      return
    }
    if (!t) {
      setError('Completá el teléfono.')
      return
    }

    try {
      const cot = await crear.mutateAsync({
        opcion,
        config,
        totalUSD,
        cliente: { nombre: n, apellido: a, email: e, telefono: t },
      })
      onCreada(cot.numeroCotizacion)
    } catch (err) {
      setError((err as ApiError).message || 'Error al crear la cotización.')
    }
  }

  return (
    <Modal open={!!opcion} onClose={onClose} title="Crear cotización" icon={Ticket} widthClass="max-w-lg">
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Generamos una cotización en estado <strong className="text-amber-600">PENDIENTE</strong> que
        después confirmás desde el panel de Cotizaciones.
      </p>

      <div className="mb-4 rounded-lg bg-[var(--bg)] p-3 text-sm text-[var(--text)]">
        <div className="font-semibold text-[var(--accent)]">
          {opcion.origenIATA} → {opcion.destinoIATA} · {opcion.aerolinea}
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <Calendar className="h-3 w-3" /> {opcion.fechaIda} → {opcion.fechaVuelta} ({opcion.noches} noches)
        </div>
        <div className="mt-0.5 text-xs text-[var(--text-muted)]">
          {opcion.escalas} · {config.personas} persona{config.personas > 1 ? 's' : ''} ·{' '}
          {CLASES_VUELO.find((c) => c.value === config.clase)?.label ?? config.clase}
          {config.cantidadValijas > 0 && ` · 🧳 ${config.cantidadValijas}`}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
          <span className="text-xs text-[var(--text-muted)]">Total:</span>
          <strong className="font-heading text-base text-[var(--accent)]">USD {totalUSD.toFixed(2)}</strong>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Nombre</label>
          <input className={inputClass} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Apellido</label>
          <input className={inputClass} value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Pérez" />
        </div>
      </div>

      <div className="mb-3">
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
          <Mail className="h-3 w-3" /> Email
        </label>
        <input
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="juan@mail.com"
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
          <Phone className="h-3 w-3" /> Teléfono
        </label>
        <input
          className={inputClass}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="+5492611234567"
        />
        <p className="mt-1 text-xs text-[var(--text-muted)]">Si el email ya existe en clientes, usamos ese cliente.</p>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onConfirmar}
          disabled={crear.isPending}
          className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
        >
          {crear.isPending ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Procesando…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Crear cotización
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
