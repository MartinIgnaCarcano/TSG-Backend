// =====================================================
// Modal "Buscar hoteles" (Flujo 6) — dispara el webhook de n8n
// directo desde el front (no pasa por el back). Paridad con
// Hoteles.js: abrirModalBuscarFlujo/dispararFlujoBuscar.
// =====================================================
import { useEffect, useState, type ReactNode } from 'react'
import { Search, Loader2, Rocket } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useBuscarFlujo6 } from '../../hooks/useHoteles'

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]'

function isoEnDias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10)
}

export function BuscarFlujo6Modal({
  open,
  onClose,
  onDisparado,
}: {
  open: boolean
  onClose: () => void
  onDisparado: () => void
}) {
  const disparar = useBuscarFlujo6()

  const [ciudad, setCiudad] = useState('')
  const [checkin, setCheckin] = useState(isoEnDias(30))
  const [checkout, setCheckout] = useState(isoEnDias(37))
  const [adults, setAdults] = useState(2)
  const [rooms, setRooms] = useState(1)
  const [estrellas, setEstrellas] = useState('')
  const [precioMax, setPrecioMax] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCiudad('')
    setCheckin(isoEnDias(30))
    setCheckout(isoEnDias(37))
    setAdults(2)
    setRooms(1)
    setEstrellas('')
    setPrecioMax('')
    setError(null)
  }, [open])

  async function disparar6() {
    if (!ciudad.trim() || !checkin || !checkout) {
      setError('Completá ciudad, check-in y check-out.')
      return
    }
    setError(null)

    let estrellasParam: string | undefined
    if (estrellas) {
      const min = parseInt(estrellas)
      estrellasParam = Array.from({ length: 5 - min + 1 }, (_, i) => min + i).join(',')
    }

    try {
      await disparar.mutateAsync({
        destinoNombre: ciudad.trim(),
        checkin,
        checkout,
        adults,
        rooms,
        estrellas: estrellasParam,
        precioMax: precioMax === '' ? undefined : precioMax,
      })
      onClose()
      onDisparado()
    } catch (e: any) {
      setError(`${e.message ?? 'Error desconocido'}\n\nVerificá que el Flujo6 esté activo en n8n.`)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Buscar hoteles (Flujo 6)" icon={Search} widthClass="max-w-lg">
      <div className="space-y-3">
        <Field label="Ciudad">
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputClass} placeholder="Ej: Madrid" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in">
            <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Check-out">
            <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Adultos">
            <input
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
              className={inputClass}
            />
          </Field>
          <Field label="Habitaciones">
            <input
              type="number"
              min={1}
              value={rooms}
              onChange={(e) => setRooms(parseInt(e.target.value) || 1)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Estrellas mínimas (opcional)">
            <select value={estrellas} onChange={(e) => setEstrellas(e.target.value)} className={inputClass}>
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}+ ★
                </option>
              ))}
            </select>
          </Field>
          <Field label="Precio máx/noche (opcional)">
            <input
              type="number"
              min={0}
              value={precioMax}
              onChange={(e) => setPrecioMax(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        {error && (
          <p className="whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

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
            onClick={disparar6}
            disabled={disparar.isPending}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            {disparar.isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Rocket className="h-3.5 w-3.5" /> Buscar hoteles
              </span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">{label}</label>
      {children}
    </div>
  )
}
