// =====================================================
// Modal "Agregar/editar hotel a cotización". Paridad con
// Cotizaciones.js: abrirModalHotel/actualizarPrecioHotel/
// guardarHotelCotizacion/quitarHotelCotizacion.
// Filtra el catálogo de hoteles por ciudad de destino (mismo
// criterio: match exacto de IATA, o nombre de ciudad sin el
// código de aeropuerto entre paréntesis).
// =====================================================
import { useEffect, useMemo, useState } from 'react'
import { Hotel as HotelIcon, Trash2, Save } from 'lucide-react'
import { Modal } from '../ui/Modal'
import type { CotizacionCompleta, Hotel } from '../../types/cotizacion'
import { useHoteles } from '../../hooks/useHoteles'
import { useActualizarCotizacion } from '../../hooks/useCotizaciones'
import type { ApiError } from '../../lib/apiClient'

function ciudadDesdeNombre(nombre: string | undefined | null): string {
  return (nombre || '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase()
}

export function HotelModal({
  cotizacion,
  onClose,
}: {
  cotizacion: CotizacionCompleta | null
  onClose: () => void
}) {
  const { data: hoteles } = useHoteles()
  const actualizar = useActualizarCotizacion()

  const [hotelId, setHotelId] = useState('')
  const [noches, setNoches] = useState(7)
  const [precio, setPrecio] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cotizacion) return
    if (cotizacion.hotelId) {
      setHotelId(cotizacion.hotelId)
      setNoches(cotizacion.noches || 7)
      setPrecio(Number(cotizacion.precioHotel) || '')
    } else {
      setHotelId('')
      setNoches(7)
      setPrecio('')
    }
    setError(null)
  }, [cotizacion])

  const destino = cotizacion?.viaje?.destino
  const desIATA = destino?.codigoIATA || ''
  const desCiudad = ciudadDesdeNombre(destino?.nombre)

  const hotelesFiltrados = useMemo(() => {
    return (hoteles ?? []).filter((h: Hotel) => {
      if (h.baja) return false
      if (!desIATA) return true
      if (h.destino?.codigoIATA === desIATA) return true
      const hCiudad = ciudadDesdeNombre(h.destino?.nombre)
      return hCiudad && hCiudad === desCiudad
    })
  }, [hoteles, desIATA, desCiudad])

  const hotelElegido = hotelesFiltrados.find((h) => h.id === hotelId)
  const precioNoche = hotelElegido ? Number(hotelElegido.precioNoche) : 0

  useEffect(() => {
    if (precioNoche && noches) setPrecio(precioNoche * noches)
  }, [precioNoche, noches])

  if (!cotizacion) return null

  async function guardar() {
    if (!cotizacion) return
    if (!hotelId) {
      setError('Elegí un hotel.')
      return
    }
    if (!noches || noches < 1) {
      setError('Ingresá la cantidad de noches.')
      return
    }
    try {
      await actualizar.mutateAsync({
        id: cotizacion.id,
        input: {
          hotelId,
          noches,
          precioHotel: typeof precio === 'number' ? precio : noches * precioNoche,
        },
      })
      onClose()
    } catch (e) {
      setError((e as ApiError).message || 'No se pudo guardar el hotel')
    }
  }

  async function quitar() {
    if (!cotizacion) return
    try {
      await actualizar.mutateAsync({ id: cotizacion.id, input: { hotelId: null, noches: null, precioHotel: null } })
      onClose()
    } catch (e) {
      setError((e as ApiError).message || 'No se pudo quitar el hotel')
    }
  }

  return (
    <Modal open={!!cotizacion} onClose={onClose} title="Agregar hotel a cotización" icon={HotelIcon}>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Destino: {destino?.nombre || '–'} ({desIATA || '–'}) — hoteles de esta ciudad
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Hotel</label>
          <select
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="">— Elegir hotel —</option>
            {hotelesFiltrados.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre} · {'★'.repeat(h.estrellas)} · USD {Number(h.precioNoche).toFixed(0)}/noche
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Noches</label>
            <input
              type="number"
              min={1}
              value={noches}
              onChange={(e) => setNoches(parseInt(e.target.value) || 0)}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--text-muted)]">Precio hotel (USD)</label>
            <input
              type="number"
              min={0}
              value={precio}
              onChange={(e) => setPrecio(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="Calculado automático"
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {!!precioNoche && !!noches && (
          <div className="rounded-lg bg-[var(--bg)] p-3 text-sm text-[var(--text)]">
            USD {precioNoche.toFixed(0)}/noche × {noches} noches ={' '}
            <strong>USD {(precioNoche * noches).toFixed(0)}</strong>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {cotizacion.hotelId && (
            <button
              type="button"
              onClick={quitar}
              disabled={actualizar.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-red-500 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Quitar hotel
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={actualizar.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" /> Guardar
          </button>
        </div>
      </div>
    </Modal>
  )
}
