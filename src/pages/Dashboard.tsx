// =====================================================
// Dashboard real (R2) — primer reemplazo de un placeholder por una
// página que consume datos del back vía TanStack Query.
// Misma lógica de negocio que Front/STG-Sistema-de-gesti-n-de-viajes-/
// Dashboard.js (KPIs, dólar con fallback, pendientes, top destinos,
// recordatorios próximos, reservas recientes), portada a React.
// =====================================================
import { useDashboardData } from '../hooks/useDashboardData'
import { useDolar } from '../hooks/useDolar'
import { useEstadisticas } from '../hooks/useEstadisticas'
import { KpiCard } from '../components/dashboard/KpiCard'
import { ListaCard, ListaItem, ListaVacia } from '../components/dashboard/ListaCard'
import { IngresosPorMesChart } from '../components/dashboard/IngresosPorMesChart'
import { ReservasPorEstadoChart } from '../components/dashboard/ReservasPorEstadoChart'
import { EstadoBadge } from '../components/ui/EstadoBadge'
import { fmtFecha, fmtMoneda, fmtMonedaExacta, fmtPesos, tipoRecordatorioLabel } from '../lib/format'
import type { Reserva } from '../types/dashboard'

export default function Dashboard() {
  const { isLoading, clientes, reservas, cotizaciones, parametros, recordatorios } = useDashboardData()
  const { data: dolar } = useDolar(parametros)
  const { data: estadisticas, isLoading: isLoadingEstadisticas, isError: isErrorEstadisticas } = useEstadisticas()

  if (isLoading) {
    return <p className="text-[var(--text-muted)]">Cargando dashboard…</p>
  }

  // ---- KPIs de negocio (Fase M1, GET /api/estadisticas) ----
  const tasaConversionPct = estadisticas ? Math.round(estadisticas.conversion.tasaConversion * 100) : null
  const ingresosMesActual = estadisticas?.ingresos.porMes.at(-1)?.total ?? 0
  const reservasActivasCount = estadisticas
    ? estadisticas.reservasPorEstado.filter((r) => r.estado !== 'CANCELADA').reduce((acc, r) => acc + r.cantidad, 0)
    : 0

  // ---- KPIs ----
  const pendientes = cotizaciones.filter((c) => c.estado === 'PENDIENTE')
  const aceptadas = cotizaciones.filter((c) => c.estado === 'ACEPTADA')

  const confirmadas = reservas.filter((r) => r.estado === 'SEÑADA')
  const enProceso = reservas.filter((r) => r.estado === 'EN_PROCESO')
  const activas = reservas.filter((r) => r.estado !== 'CANCELADA')
  const ventas = activas.reduce((acc, r) => acc + Number(r.montoFinal || 0), 0)
  const conEmail = clientes.filter((c) => c.email)

  // ---- Top destinos (sobre reservas no canceladas) ----
  const conteoDestinos = new Map<string, { nombre: string; count: number }>()
  for (const r of activas) {
    const dest = r.cotizacion?.viaje?.destino
    if (!dest) continue
    const key = dest.codigoIATA
    const actual = conteoDestinos.get(key)
    conteoDestinos.set(key, { nombre: dest.nombre, count: (actual?.count ?? 0) + 1 })
  }
  const topDestinos = [...conteoDestinos.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  const maxDestino = topDestinos[0]?.[1].count ?? 1

  // ---- Recordatorios próximos ----
  const recordatoriosPendientes = recordatorios.filter((r) => !r.ejecutado)
  const proximos = [...recordatoriosPendientes]
    .sort((a, b) => new Date(a.fechaProgramada).getTime() - new Date(b.fechaProgramada).getTime())
    .slice(0, 5)

  // ---- Reservas recientes ----
  const recientes = [...reservas].sort((a, b) => new Date(b.alta).getTime() - new Date(a.alta).getTime()).slice(0, 5)

  function ruta(r: Reserva) {
    const v = r.cotizacion?.viaje
    if (!v?.origen?.codigoIATA || !v?.destino?.codigoIATA) return '–'
    return `${v.origen.codigoIATA} → ${v.destino.codigoIATA}`
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-[var(--text)]">Dashboard</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          titulo="Cotizaciones"
          valor={cotizaciones.length}
          sub={`${pendientes.length} pendientes · ${aceptadas.length} aceptadas`}
        />
        <KpiCard
          titulo="Reservas"
          valor={reservas.length}
          sub={`${confirmadas.length} confirmadas · ${enProceso.length} en proceso`}
        />
        <KpiCard titulo="Ventas activas" valor={fmtMoneda(ventas)} sub={`${activas.length} reservas activas`} />
        <KpiCard titulo="Clientes" valor={clientes.length} sub={`${conEmail.length} con email registrado`} />
      </div>

      {/* Métricas de negocio (Fase M1) */}
      <div className="space-y-4">
        <h2 className="font-heading text-lg font-bold text-[var(--text)]">Métricas de negocio</h2>

        {isErrorEstadisticas ? (
          <p className="text-sm text-[var(--text-muted)]">No se pudieron cargar las estadísticas.</p>
        ) : isLoadingEstadisticas ? (
          <p className="text-sm text-[var(--text-muted)]">Cargando estadísticas…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                titulo="Conversión"
                valor={tasaConversionPct != null ? `${tasaConversionPct}%` : '–'}
                sub={
                  estadisticas
                    ? `${estadisticas.conversion.cotizacionesAceptadas}/${estadisticas.conversion.totalCotizaciones} cotizaciones · últimos ${estadisticas.conversion.periodoDias} días`
                    : undefined
                }
              />
              <KpiCard titulo="Ingresos del mes" valor={fmtMoneda(ingresosMesActual)} sub="mes en curso" />
              <KpiCard
                titulo="Reservas activas"
                valor={reservasActivasCount}
                sub="todos los estados excepto canceladas"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
                <h3 className="mb-3 font-heading text-base font-bold text-[var(--text)]">Ingresos por mes</h3>
                <IngresosPorMesChart porMes={estadisticas?.ingresos.porMes ?? []} />
              </div>
              <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
                <h3 className="mb-3 font-heading text-base font-bold text-[var(--text)]">Reservas por estado</h3>
                <ReservasPorEstadoChart reservasPorEstado={estadisticas?.reservasPorEstado ?? []} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dólar */}
      <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
        <h2 className="mb-3 font-heading text-base font-bold text-[var(--text)]">Dólar</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Oficial</p>
            <p className="font-heading text-xl font-bold tabular-nums text-[var(--text)]">{fmtPesos(dolar?.oficial ?? null)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Blue</p>
            <p className="font-heading text-xl font-bold tabular-nums text-[var(--text)]">{fmtPesos(dolar?.blue ?? null)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Brecha</p>
            <p className="font-heading text-xl font-bold tabular-nums text-[var(--text)]">
              {dolar?.brechaPct != null ? `${dolar.brechaPct.toFixed(1)}%` : '–'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pendientes */}
        <ListaCard titulo="Cotizaciones pendientes" badge={pendientes.length}>
          {pendientes.length === 0 ? (
            <ListaVacia texto="No hay cotizaciones pendientes" />
          ) : (
            pendientes.slice(0, 5).map((c) => {
              const cli = c.cliente
              const v = c.viaje
              const r =
                v?.origen?.codigoIATA && v?.destino?.codigoIATA
                  ? `${v.origen.codigoIATA} → ${v.destino.codigoIATA}`
                  : '–'
              return (
                <ListaItem
                  key={c.id}
                  left={
                    <>
                      <strong>
                        {cli?.nombre ?? '?'} {cli?.apellido ?? ''}
                      </strong>{' '}
                      · {r}
                    </>
                  }
                  sub={c.numeroCotizacion}
                  right={`USD ${Number(c.precioIdaYVuelta || 0).toFixed(0)}`}
                />
              )
            })
          )}
        </ListaCard>

        {/* Top destinos */}
        <ListaCard titulo="Top destinos">
          {topDestinos.length === 0 ? (
            <ListaVacia texto="Sin datos todavía" />
          ) : (
            topDestinos.map(([iata, info], i) => (
              <div key={iata} className="py-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text)]">
                    {i + 1}. {info.nombre} <span className="text-[var(--text-muted)]">({iata})</span>
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {info.count} {info.count === 1 ? 'reserva' : 'reservas'}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--border)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--accent)]"
                    style={{ width: `${(info.count / maxDestino) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </ListaCard>

        {/* Recordatorios próximos */}
        <ListaCard titulo="Recordatorios próximos" badge={recordatoriosPendientes.length}>
          {proximos.length === 0 ? (
            <ListaVacia texto="No hay recordatorios pendientes" />
          ) : (
            proximos.map((r) => (
              <ListaItem
                key={r.id}
                left={
                  <>
                    {tipoRecordatorioLabel(r.tipo)} ·{' '}
                    <strong>
                      {r.reserva?.cliente?.nombre ?? '?'} {r.reserva?.cliente?.apellido ?? ''}
                    </strong>
                  </>
                }
                sub={`Reserva ${r.reserva?.numeroReserva ?? ''}`}
                right={fmtFecha(r.fechaProgramada)}
              />
            ))
          )}
        </ListaCard>

        {/* Reservas recientes */}
        <ListaCard titulo="Reservas recientes">
          {recientes.length === 0 ? (
            <ListaVacia texto="No hay reservas todavía" />
          ) : (
            recientes.map((r) => (
              <ListaItem
                key={r.id}
                left={
                  <>
                    <strong>
                      {r.cliente?.nombre ?? '?'} {r.cliente?.apellido ?? ''}
                    </strong>{' '}
                    · {ruta(r)}
                  </>
                }
                sub={
                  <span className="inline-flex items-center gap-1.5">
                    {r.numeroReserva} <EstadoBadge estado={r.estado} />
                  </span>
                }
                right={<span className="tabular-nums">{fmtMonedaExacta(r.montoFinal)}</span>}
              />
            ))
          )}
        </ListaCard>
      </div>
    </div>
  )
}
