// =====================================================
// Recordatorios (paso 5 del plan) — paridad funcional con
// Front/STG-Sistema-de-gesti-n-de-viajes-/Recordatorios.js: mini-stats
// (pendientes/ejecutados/hoy/total), chips de filtro (pendientes/hoy/
// ejecutados/todos), orden (pendientes por fecha próxima primero,
// ejecutados por fecha de ejecución más reciente), ejecutar manual
// (marca ejecutado sin enviar WhatsApp) y eliminar definitivo.
// =====================================================
import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import {
  Calendar,
  Hourglass,
  Check,
  CalendarDays,
  BarChart3,
  Circle,
  CirclePause,
  Pin,
  DollarSign,
  PlaneTakeoff,
  Sparkles,
  CloudSun,
  Ticket,
  Rocket,
  Trash2,
  CircleAlert,
  RefreshCw,
} from 'lucide-react'
import {
  useEjecutarRecordatorio,
  useEliminarRecordatorio,
  useRecordatorios,
} from '../hooks/useRecordatorios'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { IconButton } from '../components/ui/IconButton'
import type { RecordatorioCompleto, TipoRecordatorio } from '../types/recordatorio'
import type { ApiError } from '../lib/apiClient'

type Filtro = 'pendientes' | 'hoy' | 'ejecutados' | 'todos'

const TIPO_INFO: Record<TipoRecordatorio, { icon: ComponentType<{ className?: string }>; label: string; desc: string; bg: string }> = {
  PAGO_SALDO: { icon: DollarSign, label: 'Pago de saldo', desc: '14 días antes del viaje', bg: 'bg-amber-400/20' },
  CHECK_IN: { icon: PlaneTakeoff, label: 'Check-in', desc: '1 día antes del viaje', bg: 'bg-green-400/20' },
  POST_VIAJE: { icon: Sparkles, label: 'Post-viaje', desc: '1 día después del regreso', bg: 'bg-indigo-400/25' },
  CLIMA: { icon: CloudSun, label: 'Clima', desc: '3 días antes', bg: 'bg-[var(--bg)]' },
  VOUCHER: { icon: Ticket, label: 'Voucher', desc: 'Documentación de viaje', bg: 'bg-[var(--bg)]' },
}

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function diasHasta(iso: string | null | undefined): number | null {
  if (!iso) return null
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - hoy.getTime()) / 86_400_000)
}

export default function Recordatorios() {
  const [autoRefresh, setAutoRefresh] = useState(false)
  const { data: recordatorios, isLoading, isError, error, refetch, isFetching } = useRecordatorios(autoRefresh)
  const ejecutar = useEjecutarRecordatorio()
  const eliminar = useEliminarRecordatorio()

  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [ejecutando, setEjecutando] = useState<RecordatorioCompleto | null>(null)
  const [borrando, setBorrando] = useState<RecordatorioCompleto | null>(null)

  const lista = recordatorios ?? []
  const stats = useMemo(
    () => ({
      pendientes: lista.filter((r) => !r.ejecutado).length,
      ejecutados: lista.filter((r) => r.ejecutado).length,
      hoy: lista.filter((r) => !r.ejecutado && diasHasta(r.fechaProgramada) === 0).length,
      total: lista.length,
    }),
    [lista],
  )

  const data = useMemo(() => {
    let d = [...lista]
    if (filtro === 'pendientes') d = d.filter((r) => !r.ejecutado)
    if (filtro === 'ejecutados') d = d.filter((r) => r.ejecutado)
    if (filtro === 'hoy') d = d.filter((r) => !r.ejecutado && diasHasta(r.fechaProgramada) === 0)

    d.sort((a, b) => {
      if (!a.ejecutado && !b.ejecutado) return new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime()
      if (a.ejecutado && b.ejecutado)
        return (
          new Date(b.fechaEjecucion || b.fechaProgramada).getTime() -
          new Date(a.fechaEjecucion || a.fechaProgramada).getTime()
        )
      return a.ejecutado ? 1 : -1
    })
    return d
  }, [lista, filtro])

  async function confirmarEjecutar() {
    if (!ejecutando) return
    await ejecutar.mutateAsync(ejecutando.id)
    setEjecutando(null)
  }

  async function confirmarBorrar() {
    if (!borrando) return
    await eliminar.mutateAsync(borrando.id)
    setBorrando(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-[var(--text)]">
          <Calendar className="h-5 w-5 text-[var(--accent-strong)]" /> Recordatorios
        </h1>
        <p className="text-sm text-[var(--text-muted)]">Los manda el Flujo 3 de n8n cada día a las 9:00 AM</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl2 border-l-4 border-amber-400 bg-[var(--surface)] p-4 shadow-soft">
          <div className="font-heading text-2xl font-extrabold text-[var(--text)]">{stats.pendientes}</div>
          <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <Hourglass className="h-3 w-3" /> Pendientes
          </div>
        </div>
        <div className="rounded-xl2 border-l-4 border-green-400 bg-[var(--surface)] p-4 shadow-soft">
          <div className="font-heading text-2xl font-extrabold text-[var(--text)]">{stats.ejecutados}</div>
          <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <Check className="h-3 w-3" /> Ejecutados
          </div>
        </div>
        <div className="rounded-xl2 border-l-4 border-[var(--border)] bg-[var(--surface)] p-4 shadow-soft">
          <div className="font-heading text-2xl font-extrabold text-[var(--text)]">{stats.hoy}</div>
          <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <CalendarDays className="h-3 w-3" /> Para hoy
          </div>
        </div>
        <div className="rounded-xl2 border-l-4 border-[var(--accent)] bg-[var(--surface)] p-4 shadow-soft">
          <div className="font-heading text-2xl font-extrabold text-[var(--text)]">{stats.total}</div>
          <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <BarChart3 className="h-3 w-3" /> Total
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-[var(--text-muted)]">Filtrar:</span>
        {(
          [
            ['pendientes', 'Pendientes', Hourglass],
            ['hoy', 'Hoy', CalendarDays],
            ['ejecutados', 'Ejecutados', Check],
            ['todos', 'Todos', BarChart3],
          ] as [Filtro, string, ComponentType<{ className?: string }>][]
        ).map(([key, label, ChipIcon]) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
              filtro === key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg)]'
            }`}
          >
            <ChipIcon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Actualizar
        </button>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--text)]"
        >
          {autoRefresh ? (
            <>
              <Circle className="h-3 w-3 fill-green-500 text-green-500" /> Auto: ON (10s)
            </>
          ) : (
            <>
              <CirclePause className="h-3.5 w-3.5" /> Auto: OFF
            </>
          )}
        </button>
      </div>

      {isLoading && <p className="py-8 text-center text-[var(--text-muted)]">Cargando…</p>}
      {isError && !isLoading && (
        <p className="flex items-center justify-center gap-1.5 py-8 text-center text-red-500">
          <CircleAlert className="h-4 w-4" /> {(error as unknown as ApiError)?.message ?? 'no se pudo cargar'}
        </p>
      )}
      {!isLoading && !isError && data.length === 0 && (
        <p className="rounded-xl2 bg-[var(--surface)] py-8 text-center text-[var(--text-muted)]">
          No hay recordatorios {filtro === 'todos' ? '' : 'en este filtro'}
        </p>
      )}

      <div className="space-y-2">
        {data.map((r) => {
          const info = TIPO_INFO[r.tipo] ?? { icon: Pin, label: r.tipo, desc: '', bg: 'bg-[var(--bg)]' }
          const rsv = r.reserva
          const cli = rsv?.cliente
          const v = rsv?.cotizacion?.viaje
          const ruta = v?.origen?.codigoIATA && v?.destino?.codigoIATA ? `${v.origen.codigoIATA} → ${v.destino.codigoIATA}` : '–'

          const dias = diasHasta(r.fechaProgramada)
          let fechaColor = 'text-[var(--text)]'
          let fechaTxt = dias != null ? `en ${dias} día${dias === 1 ? '' : 's'}` : ''
          if (r.ejecutado) {
            fechaColor = 'text-[var(--text-muted)]'
            fechaTxt = r.fechaEjecucion ? 'Ejecutado ' + fmtFecha(r.fechaEjecucion) : 'Ejecutado'
          } else if (dias === 0) {
            fechaColor = 'text-amber-500'
            fechaTxt = 'Hoy'
          } else if (dias != null && dias < 0) {
            fechaColor = 'text-red-500'
            fechaTxt = `Hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
          }

          return (
            <div
              key={r.id}
              className={`grid grid-cols-[42px_1.5fr_1.5fr_1fr_0.8fr_auto] items-center gap-3 rounded-xl2 bg-[var(--surface)] px-4 py-3 shadow-soft ${
                r.ejecutado ? 'opacity-60' : ''
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${info.bg}`}>
                <info.icon className="h-5 w-5 text-[var(--text)]" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text)]">{info.label}</div>
                <div className="text-xs text-[var(--text-muted)]">{info.desc}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">
                  {cli?.nombre || '?'} {cli?.apellido || ''}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {rsv?.numeroReserva || ''} · {ruta}
                </div>
              </div>
              <div>
                <div className={`font-heading text-sm font-bold ${fechaColor}`}>{fmtFecha(r.fechaProgramada)}</div>
                <div className="text-xs text-[var(--text-muted)]">{fechaTxt}</div>
              </div>
              <div>
                {r.ejecutado ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-400/15 px-2 py-0.5 text-xs font-semibold text-green-500">
                    <Check className="h-3 w-3" /> Enviado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-500">
                    <Hourglass className="h-3 w-3" /> Pendiente
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-1.5">
                {r.ejecutado ? (
                  <span className="text-xs text-[var(--text-muted)]">{r.resultado || ''}</span>
                ) : (
                  <IconButton icon={Rocket} label="Ejecutar" variant="accent" withLabel onClick={() => setEjecutando(r)} />
                )}
                <IconButton icon={Trash2} label="Eliminar" variant="danger" onClick={() => setBorrando(r)} />
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={!!ejecutando}
        onClose={() => setEjecutando(null)}
        onConfirm={confirmarEjecutar}
        pending={ejecutar.isPending}
        confirmLabel="Marcar ejecutado"
        mensaje="¿Marcar este recordatorio como ejecutado? No envía WhatsApp, solo cambia el estado en la DB."
      />
      <ConfirmDialog
        open={!!borrando}
        onClose={() => setBorrando(null)}
        onConfirm={confirmarBorrar}
        pending={eliminar.isPending}
        confirmLabel="Eliminar"
        mensaje="¿Eliminar este recordatorio? Esta acción no se puede deshacer (no es baja lógica)."
      />
    </div>
  )
}
