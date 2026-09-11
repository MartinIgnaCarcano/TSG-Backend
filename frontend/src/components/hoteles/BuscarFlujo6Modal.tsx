// =====================================================
// Modal "Buscar hoteles" (Flujo 6). Busca en Booking vía el back
// (POST /api/hoteles/buscar-externo → webhook de n8n) y guarda los
// resultados en el catálogo, colgados del destino elegido.
//
// El destino se elige de la lista, no se escribe: los hoteles tienen que
// quedar asociados a un Destino que exista. Antes se mandaba solo el texto
// de la ciudad y el flujo inventaba el IATA con sus 3 primeras letras
// ("Buenos Aires" → "BUE"), así que el back descartaba todo en silencio.
// =====================================================
import { useEffect, useState, type ReactNode } from 'react'
import { Search, Loader2, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '../ui/Modal'
import { useBuscarFlujo6, useDestinos } from '../../hooks/useHoteles'
import type { ApiError } from '../../lib/apiClient'

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
  /** Se llama con el id del destino buscado cuando la búsqueda terminó bien. */
  onDisparado: (destinoId: string) => void
}) {
  const disparar = useBuscarFlujo6()
  const { data: destinos } = useDestinos()

  const [destinoId, setDestinoId] = useState('')
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
    setDestinoId('')
    setCiudad('')
    setCheckin(isoEnDias(30))
    setCheckout(isoEnDias(37))
    setAdults(2)
    setRooms(1)
    setEstrellas('')
    setPrecioMax('')
    setError(null)
  }, [open])

  const destinoElegido = destinos?.find((d) => d.id === destinoId)

  async function buscar() {
    if (!destinoId || !checkin || !checkout) {
      setError('Elegí un destino y completá check-in y check-out.')
      return
    }
    if (checkout <= checkin) {
      setError('El check-out tiene que ser posterior al check-in.')
      return
    }
    setError(null)

    try {
      const res = await disparar.mutateAsync({
        destinoId,
        ciudad: ciudad.trim() || undefined,
        checkin,
        checkout,
        adults,
        rooms,
        estrellasMin: estrellas ? parseInt(estrellas) : undefined,
        precioMax: precioMax === '' ? undefined : precioMax,
      })
      toast.success(`Hoteles de ${res.destino.nombre} actualizados`, {
        description: `Booking devolvió ${res.encontrados}: ${res.creados} nuevos, ${res.actualizados} actualizados.`,
      })
      onClose()
      onDisparado(destinoId)
    } catch (e) {
      setError((e as unknown as ApiError)?.message ?? 'Error desconocido')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Buscar hoteles en Booking" icon={Search} widthClass="max-w-lg">
      <div className="space-y-3">
        <Field label="Destino del catálogo">
          <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className={inputClass}>
            <option value="">Elegí un destino…</option>
            {(destinos ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre} ({d.codigoIATA}) · {d.pais}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Buscar en Booking como (opcional)">
          <input
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            className={inputClass}
            placeholder={destinoElegido ? destinoElegido.nombre : 'Ej: Rome, en vez de Roma'}
          />
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
              max={10}
              value={adults}
              onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
              className={inputClass}
            />
          </Field>
          <Field label="Habitaciones">
            <input
              type="number"
              min={1}
              max={5}
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
          <Field label="Precio máx/noche USD (opcional)">
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
            onClick={buscar}
            disabled={disparar.isPending}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            {disparar.isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando en Booking…
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
