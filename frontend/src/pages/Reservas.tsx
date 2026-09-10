// =====================================================
// Reservas (paso 4 del plan) — paridad funcional con
// Front/STG-Sistema-de-gesti-n-de-viajes-/Reservas.js: filtro por
// teléfono, orden (reciente/antiguo/en proceso/confirmadas/viaje
// próximo), badge de saldo y fecha de viaje, editar, registrar
// pago, confirmar y eliminar (baja lógica). Auto-refresh con toggle
// manual (default OFF, igual que el vanilla post-DOMContentLoaded
// que arranca en ON — acá arranca en ON para igualar el comportamiento).
// =====================================================
import { useMemo, useState } from 'react'
import {
  ClipboardList,
  Phone,
  Calendar,
  PlaneTakeoff,
  DollarSign,
  Circle,
  CirclePause,
  Pencil,
  Wallet,
  Check,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'
import {
  useConfirmarReserva,
  useEliminarReserva,
  useReservas,
} from '../hooks/useReservas'
import { EditarReservaModal } from '../components/reservas/EditarReservaModal'
import { RegistrarPagoModal } from '../components/reservas/RegistrarPagoModal'
import { GestionReservaModal } from '../components/reservas/GestionReservaModal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { IconButton } from '../components/ui/IconButton'
import { EstadoBadge } from '../components/ui/EstadoBadge'
import { SkeletonTableRows } from '../components/ui/Skeleton'
import { fmtMonedaExacta } from '../lib/format'
import type { ReservaCompleta } from '../types/reserva'
import type { ApiError } from '../lib/apiClient'

type Sort = 'reciente' | 'antiguo' | 'pendiente' | 'confirmada' | 'viaje-proximo'

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function diasHasta(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoy.getTime()) / 86_400_000)
}

export default function Reservas() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { data: reservas, isLoading, isError, error } = useReservas(autoRefresh)
  const confirmar = useConfirmarReserva()
  const eliminar = useEliminarReserva()

  const [telFiltro, setTelFiltro] = useState('')
  const [sort, setSort] = useState<Sort>('reciente')
  const [editando, setEditando] = useState<ReservaCompleta | null>(null)
  const [pagando, setPagando] = useState<ReservaCompleta | null>(null)
  const [eliminando, setEliminando] = useState<ReservaCompleta | null>(null)
  const [gestionando, setGestionando] = useState<string | null>(null)

  const data = useMemo(() => {
    let lista = [...(reservas ?? [])]
    const tel = telFiltro.trim()
    if (tel) lista = lista.filter((r) => r.cliente?.telefono?.includes(tel))

    const ts = (r: ReservaCompleta) => new Date(r.alta || 0).getTime()
    if (sort === 'reciente') lista.sort((a, b) => ts(b) - ts(a))
    if (sort === 'antiguo') lista.sort((a, b) => ts(a) - ts(b))
    if (sort === 'pendiente') lista.sort((a, b) => (a.estado === 'EN_PROCESO' ? -1 : 1) - (b.estado === 'EN_PROCESO' ? -1 : 1))
    if (sort === 'confirmada') lista.sort((a, b) => (a.estado === 'SEÑADA' ? -1 : 1) - (b.estado === 'SEÑADA' ? -1 : 1))
    if (sort === 'viaje-proximo')
      lista.sort((a, b) => {
        const da = a.fechaViaje ? new Date(a.fechaViaje).getTime() : Infinity
        const db = b.fechaViaje ? new Date(b.fechaViaje).getTime() : Infinity
        return da - db
      })
    return lista
  }, [reservas, telFiltro, sort])

  async function confirmarEliminar() {
    if (!eliminando) return
    await eliminar.mutateAsync(eliminando.id)
    setEliminando(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-[var(--text)]">
          <ClipboardList className="h-5 w-5 text-[var(--accent-strong)]" /> Reservas
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Listado de reservas — las generadas por el bot WhatsApp aparecen automáticamente.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
            <Phone className="h-3 w-3" /> Buscar por teléfono
          </label>
          <input
            value={telFiltro}
            onChange={(e) => setTelFiltro(e.target.value)}
            placeholder="Ej: +5492611234567"
            className="w-56 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
            <Calendar className="h-3 w-3" /> Ordenar por
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="w-48 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="reciente">Más reciente</option>
            <option value="antiguo">Más antiguo</option>
            <option value="pendiente">En proceso primero</option>
            <option value="confirmada">Confirmadas primero</option>
            <option value="viaje-proximo">Viaje próximo</option>
          </select>
        </div>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
        >
          {autoRefresh ? (
            <>
              <Circle className="h-3 w-3 fill-green-500 text-green-500" /> Auto-refresh: ON (5s)
            </>
          ) : (
            <>
              <CirclePause className="h-3.5 w-3.5" /> Auto-refresh: OFF
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl2 border border-[var(--border)] bg-[var(--surface)] shadow-soft">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--text-muted)]">
              <th className="px-4 py-3"># Reserva</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Ruta / Tipo</th>
              <th className="px-4 py-3">
                <span className="inline-flex items-center gap-1">
                  <PlaneTakeoff className="h-3 w-3" /> Fecha viaje
                </span>
              </th>
              <th className="px-4 py-3">
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Monto / Saldo
                </span>
              </th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <SkeletonTableRows cols={7} />}
            {isError && !isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-red-500">
                  Error al cargar: {(error as unknown as ApiError)?.message ?? 'no se pudo cargar la lista'}
                </td>
              </tr>
            )}
            {!isLoading && !isError && data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  No hay reservas.
                </td>
              </tr>
            )}

            {data.map((r) => {
              const cli = r.cliente || ({} as ReservaCompleta['cliente'])
              const v = r.cotizacion?.viaje
              const ruta =
                v?.origen?.codigoIATA && v?.destino?.codigoIATA
                  ? `${v.origen.codigoIATA} → ${v.destino.codigoIATA}`
                  : '–'
              const tipo = (r.tipoReserva || '').replace('_', ' & ')

              const saldoPendiente = Number(r.saldoPendiente ?? Number(r.montoFinal) - Number(r.saldoPagado || 0))
              const tienePend = saldoPendiente > 0.01

              const dias = diasHasta(r.fechaViaje)
              let fechaColor = 'text-[var(--text-muted)]'
              let sufijo = ''
              if (r.fechaViaje && dias != null) {
                if (dias < 0) sufijo = ' (pasado)'
                else if (dias === 0) {
                  fechaColor = 'text-amber-500'
                  sufijo = ' (¡hoy!)'
                } else if (dias <= 7) {
                  fechaColor = 'text-amber-500'
                  sufijo = ` (en ${dias}d)`
                } else if (dias <= 30) {
                  fechaColor = 'text-emerald-600'
                  sufijo = ` (en ${dias}d)`
                } else sufijo = ` (en ${dias}d)`
              }

              return (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-b-0 align-top">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                    {r.numeroReserva || r.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[var(--text)]">
                      {cli.nombre || '?'} {cli.apellido || ''}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">{cli.email || cli.telefono || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div>{ruta}</div>
                    <div className="text-xs text-[var(--text-muted)]">{tipo}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.fechaViaje ? (
                      <span className={fechaColor}>
                        {fmtFecha(r.fechaViaje)}
                        {sufijo}
                      </span>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums">
                    <div>{fmtMonedaExacta(r.montoFinal)}</div>
                    {tienePend ? (
                      <div className="flex items-center gap-1 text-xs text-amber-500">
                        <TriangleAlert className="h-3 w-3" /> Pend: {fmtMonedaExacta(saldoPendiente)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-emerald-600">
                        <Check className="h-3 w-3" /> Pagado
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={r.estado} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <IconButton icon={Pencil} label="Editar" onClick={() => setEditando(r)} />
                      <IconButton
                        icon={Users}
                        label="Gestionar (pasajeros, pagos, documentos)"
                        withLabel
                        onClick={() => setGestionando(r.id)}
                      />
                      {tienePend && (
                        <IconButton
                          icon={Wallet}
                          label="Registrar pago"
                          variant="success"
                          withLabel
                          onClick={() => setPagando(r)}
                        />
                      )}
                      {r.estado === 'EN_PROCESO' && (
                        <IconButton
                          icon={Check}
                          label="Confirmar seña"
                          variant="accent"
                          disabled={confirmar.isPending}
                          onClick={() => confirmar.mutate(r.id)}
                        />
                      )}
                      <IconButton icon={Trash2} label="Eliminar" variant="danger" onClick={() => setEliminando(r)} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <EditarReservaModal reserva={editando} onClose={() => setEditando(null)} />
      <RegistrarPagoModal reserva={pagando} onClose={() => setPagando(null)} />
      <GestionReservaModal reservaId={gestionando} onClose={() => setGestionando(null)} />
      <ConfirmDialog
        open={!!eliminando}
        onClose={() => setEliminando(null)}
        onConfirm={confirmarEliminar}
        pending={eliminar.isPending}
        confirmLabel="Eliminar reserva"
        mensaje={eliminando ? `¿Eliminar la reserva ${eliminando.numeroReserva || ''}? Es una baja lógica.` : ''}
      />
    </div>
  )
}
