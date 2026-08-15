// =====================================================
// Hoteles (paso 6 del plan) — paridad funcional con
// Front/STG-Sistema-de-gesti-n-de-viajes-/Hoteles.js: catálogo en grid,
// filtros (nombre/descripción, destino, estrellas), alta/edición/baja
// lógica, y disparo del Flujo 6 de n8n (búsqueda externa) con polling
// 3x/8s de refresco posterior.
// =====================================================
import { useMemo, useRef, useState } from 'react'
import {
  Hotel as HotelIcon,
  Search,
  Plus,
  CircleAlert,
  MapPin,
  Globe,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  useActualizarHotel,
  useCrearHotel,
  useDestinos,
  useEliminarHotel,
  useHotelesCompletos,
} from '../hooks/useHoteles'
import { HotelFormModal } from '../components/hoteles/HotelFormModal'
import { BuscarFlujo6Modal } from '../components/hoteles/BuscarFlujo6Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { IconButton } from '../components/ui/IconButton'
import type { HotelCompleto } from '../types/hotel'
import type { HotelInput } from '../schemas/hotel.schema'
import type { ApiError } from '../lib/apiClient'

function stars(n: number): string {
  return '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))
}

const FUENTE_BADGE: Record<string, string> = {
  MANUAL: 'bg-[var(--bg)] text-[var(--text-muted)]',
  RAPIDAPI: 'bg-indigo-400/20 text-indigo-500',
  BOOKING: 'bg-blue-400/20 text-blue-500',
}

export default function Hoteles() {
  const { data: hoteles, isLoading, isError, error, refetch } = useHotelesCompletos()
  const { data: destinos } = useDestinos()
  const crear = useCrearHotel()
  const actualizar = useActualizarHotel()
  const eliminar = useEliminarHotel()

  const [busqueda, setBusqueda] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [estrellas, setEstrellas] = useState('')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState<HotelCompleto | null>(null)
  const [borrando, setBorrando] = useState<HotelCompleto | null>(null)
  const [buscarAbierto, setBuscarAbierto] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const filtrados = useMemo(() => {
    let data = [...(hoteles ?? [])]
    const q = busqueda.trim().toLowerCase()
    if (q) {
      data = data.filter(
        (h) => h.nombre.toLowerCase().includes(q) || (h.descripcion ?? '').toLowerCase().includes(q),
      )
    }
    if (destinoId) data = data.filter((h) => h.destinoId === destinoId)
    if (estrellas) data = data.filter((h) => h.estrellas === parseInt(estrellas))
    return data
  }, [hoteles, busqueda, destinoId, estrellas])

  function abrirNuevo() {
    setEditando(null)
    setFormError(null)
    setModalAbierto(true)
  }

  function abrirEditar(h: HotelCompleto) {
    setEditando(h)
    setFormError(null)
    setModalAbierto(true)
  }

  async function onSubmit(values: HotelInput) {
    setFormError(null)
    const input = {
      ...values,
      rating: values.rating === '' || values.rating == null ? undefined : Number(values.rating),
    }
    try {
      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, input })
      } else {
        await crear.mutateAsync(input)
      }
      setModalAbierto(false)
    } catch (e) {
      setFormError((e as ApiError).message || 'No se pudo guardar el hotel')
    }
  }

  async function confirmarBorrado() {
    if (!borrando) return
    await eliminar.mutateAsync(borrando.id)
    setBorrando(null)
  }

  // Tras disparar el Flujo 6, intenta refrescar 3 veces con 8s de
  // intervalo (igual que el vanilla), por si n8n ya insertó hoteles.
  function onDisparado() {
    if (pollRef.current) clearInterval(pollRef.current)
    let intentos = 0
    pollRef.current = setInterval(() => {
      intentos++
      refetch()
      if (intentos >= 3 && pollRef.current) clearInterval(pollRef.current)
    }, 8_000)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-[var(--text)]">
            <HotelIcon className="h-5 w-5 text-[var(--accent-strong)]" /> Hoteles
          </h1>
          <p className="text-sm text-[var(--text-muted)]">Catálogo usado en cotizaciones y por el Flujo 6 (búsqueda externa)</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBuscarAbierto(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
          >
            <Search className="h-4 w-4" /> Buscar (Flujo 6)
          </button>
          <button
            onClick={abrirNuevo}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
          >
            <Plus className="h-4 w-4" /> Nuevo hotel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre o descripción"
          className="w-64 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        <select
          value={destinoId}
          onChange={(e) => setDestinoId(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todos los destinos</option>
          {(destinos ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigoIATA} — {d.nombre}
            </option>
          ))}
        </select>
        <select
          value={estrellas}
          onChange={(e) => setEstrellas(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todas las estrellas</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="py-8 text-center text-[var(--text-muted)]">Cargando…</p>}
      {isError && !isLoading && (
        <p className="flex items-center justify-center gap-1.5 py-8 text-center text-red-500">
          <CircleAlert className="h-4 w-4" /> {(error as unknown as ApiError)?.message ?? 'no se pudo cargar'}
        </p>
      )}
      {!isLoading && !isError && filtrados.length === 0 && (
        <p className="rounded-xl2 bg-[var(--surface)] py-8 text-center text-[var(--text-muted)]">
          No hay hoteles con esos filtros. Probá disparar el Flujo 6 para traer más.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtrados.map((h) => (
          <div key={h.id} className="overflow-hidden rounded-xl2 border border-[var(--border)] bg-[var(--surface)] shadow-soft">
            <div className="relative flex h-32 items-center justify-center bg-[var(--bg)] text-4xl">
              {h.urlImagen ? (
                <img
                  src={h.urlImagen}
                  alt={h.nombre}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                <HotelIcon className="h-10 w-10 text-[var(--text-muted)]" />
              )}
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                {h.destino?.codigoIATA || '?'}
              </span>
              <span
                className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold ${FUENTE_BADGE[h.fuente] ?? FUENTE_BADGE.MANUAL}`}
              >
                {h.fuente}
              </span>
            </div>
            <div className="space-y-2 p-4">
              <div className="font-semibold text-[var(--text)]">{h.nombre}</div>
              <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                <MapPin className="h-3 w-3" /> {h.destino?.nombre || '–'} · {h.destino?.pais || ''}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-amber-400">{stars(h.estrellas)}</span>
                {h.rating != null && (
                  <span className="text-xs text-[var(--text-muted)]">★ {Number(h.rating).toFixed(1)}</span>
                )}
              </div>
              {h.descripcion && <p className="text-xs text-[var(--text-muted)] line-clamp-2">{h.descripcion}</p>}
              <div className="flex items-end justify-between pt-1">
                <div>
                  <div className="font-heading text-lg font-bold text-[var(--text)]">
                    USD {Number(h.precioNoche).toFixed(0)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">por noche</div>
                </div>
                <div className="flex gap-1.5">
                  {h.urlReserva && (
                    <a
                      href={h.urlReserva}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      title="Ver reserva"
                    >
                      <Globe className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <IconButton icon={Pencil} label="Editar" onClick={() => abrirEditar(h)} />
                  <IconButton icon={Trash2} label="Eliminar" variant="danger" onClick={() => setBorrando(h)} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <HotelFormModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        onSubmit={onSubmit}
        hotel={editando}
        destinos={destinos ?? []}
        pending={crear.isPending || actualizar.isPending}
        serverError={formError}
      />

      <BuscarFlujo6Modal open={buscarAbierto} onClose={() => setBuscarAbierto(false)} onDisparado={onDisparado} />

      <ConfirmDialog
        open={!!borrando}
        onClose={() => setBorrando(null)}
        onConfirm={confirmarBorrado}
        pending={eliminar.isPending}
        mensaje={borrando ? `¿Eliminar "${borrando.nombre}"? Es una baja lógica.` : ''}
      />
    </div>
  )
}
