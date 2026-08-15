// =====================================================
// Cotizaciones (paso 3 del plan) — el vendedor confirma las
// generadas por el bot. Paridad funcional con
// Front/STG-Sistema-de-gesti-n-de-viajes-/Cotizaciones.js:
// filtro por estado, confirmar → crea Reserva + pasa a ACEPTADA,
// agregar/editar/quitar hotel, cancelar (baja lógica).
// Auto-refresh: acá siempre activo via refetchInterval (5s), a
// diferencia del vanilla donde era un toggle manual.
// =====================================================
import { useMemo, useState } from 'react'
import {
  MessageSquare,
  Mail,
  Phone,
  PlaneTakeoff,
  PlaneLanding,
  Hotel,
  Check,
  Pencil,
  Plus,
  Trash2,
  Circle,
  Send,
  CircleCheck,
  Hourglass,
} from 'lucide-react'
import { useCancelarCotizacion, useCotizaciones } from '../hooks/useCotizaciones'
import { ConfirmarReservaModal } from '../components/cotizaciones/ConfirmarReservaModal'
import { HotelModal } from '../components/cotizaciones/HotelModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import { IconButton } from '../components/ui/IconButton'
import { SkeletonTableRows } from '../components/ui/Skeleton'
import { fechaHora, fmtFechaLarga, fmtMonedaExacta } from '../lib/format'
import { CLASE_VUELO_LABEL, type CotizacionCompleta, type EstadoCotizacion } from '../types/cotizacion'
import type { ApiError } from '../lib/apiClient'

const ESTADO_BADGE: Record<string, { label: string; tone: BadgeTone; icon: typeof Circle }> = {
  PENDIENTE: { label: 'Pendiente', tone: 'warning', icon: Circle },
  ENVIADA: { label: 'Enviada', tone: 'info', icon: Send },
  ACEPTADA: { label: 'Aceptada', tone: 'success', icon: CircleCheck },
  VENCIDA: { label: 'Vencida', tone: 'neutral', icon: Hourglass },
}

export default function Cotizaciones() {
  const { data: cotizaciones, isLoading, isError, error } = useCotizaciones()
  const cancelar = useCancelarCotizacion()

  const [filtroEstado, setFiltroEstado] = useState<EstadoCotizacion | ''>('PENDIENTE')
  const [confirmando, setConfirmando] = useState<CotizacionCompleta | null>(null)
  const [editandoHotel, setEditandoHotel] = useState<CotizacionCompleta | null>(null)
  const [cancelando, setCancelando] = useState<CotizacionCompleta | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const data = useMemo(() => {
    const lista = (cotizaciones ?? []).filter((c) => !filtroEstado || c.estado === filtroEstado)
    return [...lista].sort((a, b) => {
      if (a.estado === 'PENDIENTE' && b.estado !== 'PENDIENTE') return -1
      if (a.estado !== 'PENDIENTE' && b.estado === 'PENDIENTE') return 1
      return new Date(b.alta).getTime() - new Date(a.alta).getTime()
    })
  }, [cotizaciones, filtroEstado])

  async function confirmarCancelacion() {
    if (!cancelando) return
    await cancelar.mutateAsync(cancelando.id)
    setCancelando(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-[var(--text)]">
            <MessageSquare className="h-5 w-5 text-[var(--accent-strong)]" /> Cotizaciones
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Cotizaciones generadas por el bot — confirmá las pendientes para convertirlas en reservas
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Filtrar por estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoCotizacion | '')}
            className="w-48 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="PENDIENTE">Pendientes</option>
            <option value="">Todas</option>
            <option value="ACEPTADA">Aceptadas</option>
            <option value="ENVIADA">Enviadas</option>
            <option value="VENCIDA">Vencidas</option>
          </select>
        </div>
      </div>

      {aviso && (
        <div className="rounded-lg bg-emerald-100 px-4 py-2 text-sm text-emerald-700">
          {aviso}{' '}
          <button onClick={() => setAviso(null)} className="ml-2 underline">
            cerrar
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl2 border border-[var(--border)] bg-[var(--surface)] shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3"># Cotización</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Ruta</th>
              <th className="px-4 py-3">Fechas</th>
              <th className="px-4 py-3">Aerolínea</th>
              <th className="px-4 py-3">Total (USD)</th>
              <th className="px-4 py-3">Vencimiento</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows cols={9} />}
            {isError && !isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-red-500">
                  Error: {(error as unknown as ApiError)?.message ?? 'no se pudo cargar la lista'}
                </td>
              </tr>
            )}
            {!isLoading && !isError && data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  No hay cotizaciones.
                </td>
              </tr>
            )}

            {data.map((c) => {
              const cli = c.cliente
              const v = c.viaje
              const ruta = v?.origen?.codigoIATA && v?.destino?.codigoIATA ? `${v.origen.codigoIATA} → ${v.destino.codigoIATA}` : '–'
              const tramos = v?.tramos || []
              const ida = fechaHora(tramos[0]?.horaSalida)
              const vuelta = fechaHora(tramos[tramos.length - 1]?.horaSalida)
              const badge = ESTADO_BADGE[c.estado] ?? { label: c.estado, className: 'bg-slate-200 text-slate-700' }

              const venc = c.fechaVencimiento ? new Date(c.fechaVencimiento) : null
              const diasVenc = venc ? Math.round((venc.getTime() - Date.now()) / 86_400_000) : null

              const total = c.hotel
                ? Number(c.precioIdaYVuelta) + Number(c.impuestos) + Number(c.precioHotel)
                : null

              return (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-b-0 align-top">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{c.numeroCotizacion}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--text)]">
                      {cli.nombre} {cli.apellido}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <Mail className="h-3 w-3" /> {cli.email || '–'}
                    </div>
                    {cli.telefono && (
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Phone className="h-3 w-3" /> {cli.telefono}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-semibold text-[var(--accent-strong)]">{ruta}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-1">
                      <PlaneTakeoff className="h-3 w-3 text-[var(--text-muted)]" /> {ida.fecha}{' '}
                      <span className="text-[var(--text-muted)]">{ida.hora}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <PlaneLanding className="h-3 w-3 text-[var(--text-muted)]" /> {vuelta.fecha}{' '}
                      <span className="text-[var(--text-muted)]">{vuelta.hora}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold">{tramos[0]?.aerolinea || '–'}</div>
                    <div className={v?.tieneEscalas ? 'text-amber-500' : 'text-emerald-600'}>
                      {v?.tieneEscalas ? '↳ con escala' : '↳ directo'}
                    </div>
                    <div className="mt-0.5 text-[var(--text-muted)]">
                      {CLASE_VUELO_LABEL[c.clase] ?? c.clase}
                      {c.cantidadValijas > 0 && ` · 🧳 ${c.cantidadValijas}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums">
                    <div className="font-semibold">{fmtMonedaExacta(c.precioIdaYVuelta)}</div>
                    <div className="text-xs text-[var(--text-muted)]">+ imp {fmtMonedaExacta(c.impuestos)}</div>
                    {c.extras && (
                      <div className="text-xs text-[var(--text-muted)]" title={c.extras}>
                        🧳 {c.extras}
                        {Number(c.precioExtras) > 0 && ` (${fmtMonedaExacta(c.precioExtras)})`}
                      </div>
                    )}
                    {c.hotel && (
                      <div className="flex items-center gap-1 text-xs text-blue-500">
                        <Hotel className="h-3 w-3" /> {c.hotel.nombre} · {c.noches}n · +{fmtMonedaExacta(c.precioHotel)}
                      </div>
                    )}
                    {total != null && <div className="text-xs font-bold text-[var(--accent-strong)]">Total: {fmtMonedaExacta(total)}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {fmtFechaLarga(c.fechaVencimiento)}
                    {diasVenc != null && (
                      <span className={diasVenc < 0 ? 'text-red-500' : diasVenc <= 2 ? 'text-amber-500' : 'text-[var(--text-muted)]'}>
                        {' '}
                        {diasVenc < 0 ? '(vencida)' : `(${diasVenc}d)`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={badge.tone} icon={badge.icon}>
                      {badge.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {c.estado === 'PENDIENTE' && (
                        <IconButton
                          icon={Check}
                          label="Confirmar"
                          variant="accent"
                          withLabel
                          onClick={() => setConfirmando(c)}
                        />
                      )}
                      <IconButton
                        icon={c.hotel ? Pencil : Plus}
                        label={c.hotel ? 'Editar hotel' : 'Agregar hotel'}
                        onClick={() => setEditandoHotel(c)}
                      />
                      <IconButton icon={Trash2} label="Cancelar cotización" variant="danger" onClick={() => setCancelando(c)} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmarReservaModal
        cotizacion={confirmando}
        onClose={() => setConfirmando(null)}
        onConfirmada={(numero) => {
          setConfirmando(null)
          setAviso(`Reserva ${numero} creada y cotización aceptada.`)
        }}
      />

      <HotelModal cotizacion={editandoHotel} onClose={() => setEditandoHotel(null)} />

      <ConfirmDialog
        open={!!cancelando}
        onClose={() => setCancelando(null)}
        onConfirm={confirmarCancelacion}
        pending={cancelar.isPending}
        confirmLabel="Cancelar cotización"
        mensaje={cancelando ? `¿Cancelar la cotización ${cancelando.numeroCotizacion}? Es una baja lógica.` : ''}
      />
    </div>
  )
}
