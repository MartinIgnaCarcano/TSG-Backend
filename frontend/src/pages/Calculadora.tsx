// =====================================================
// Calculadora — búsqueda en vivo de vuelos contra el back, portada de
// Front/STG-Sistema-de-gesti-n-de-viajes-/Calculadora.js. Mismo motor
// (Google Flights vía RapidAPI, spread de 5 fechas) y misma lógica de
// filtros/cálculo, en componentes React con TanStack Query.
// =====================================================
import { useMemo, useState } from 'react'
import {
  Search,
  Calendar,
  PlaneTakeoff,
  PlaneLanding,
  DollarSign,
  Target,
  TrendingDown,
  Settings,
  FileText,
  Briefcase,
  Users,
  Plane,
  Ticket,
  Loader2,
  X,
  CircleAlert,
  TriangleAlert,
  Trophy,
  FrownIcon,
} from 'lucide-react'
import { useBuscarVuelos, useParametrosDolar } from '../hooks/useCalculadora'
import { ReservarModal } from '../components/calculadora/ReservarModal'
import type { ApiError } from '../lib/apiClient'
import { CLASES_VUELO } from '../types/calculadora'
import type { ClaseVuelo, ConfigReserva, ModoFiltro, OpcionVuelo } from '../types/calculadora'

function cantidadEscalas(escalasStr: string | null | undefined): number {
  if (!escalasStr) return 0
  if (/directo/i.test(escalasStr)) return 0
  const m = escalasStr.match(/^(\d+)\s+escala/)
  return m ? parseInt(m[1], 10) : 0
}

function fmt(n: number | null | undefined, prefix = '$'): string {
  if (n == null) return '–'
  return prefix + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
}

// Paridad con Calculadora.js vanilla (VALIJA_PRECIO): precio sugerido por
// valija cuando el usuario carga cantidad pero no un precio manual. Vanilla
// usaba esto solo para la vista previa en pantalla y no para el total que
// se guardaba en la cotización — acá lo unificamos para que el preview y la
// cotización creada muestren siempre el mismo total.
const VALIJA_PRECIO_SUGERIDO = 75

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

const chipClass = (activo: boolean) =>
  `inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
    activo
      ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]'
  }`

export default function Calculadora() {
  const [fechaIda, setFechaIda] = useState('')
  const [fechaVuelta, setFechaVuelta] = useState('')
  const [origenTexto, setOrigenTexto] = useState('')
  const [destinoTexto, setDestinoTexto] = useState('')
  const [clase, setClase] = useState<ClaseVuelo>('ECONOMICA')
  const [modoFiltro, setModoFiltro] = useState<ModoFiltro>(null)

  const [opcionesData, setOpcionesData] = useState<OpcionVuelo[]>([])
  const [seleccionIdx, setSeleccionIdx] = useState<number | null>(null)
  const [buscarError, setBuscarError] = useState<string | null>(null)
  const [sinResultados, setSinResultados] = useState<string | null>(null)

  const [personas, setPersonas] = useState(1)
  const [cantidadValijas, setCantidadValijas] = useState(0)
  const [valijasPrecio, setValijasPrecio] = useState(0)
  const [valijasDesc, setValijasDesc] = useState('')
  const [extraPrecio, setExtraPrecio] = useState(0)
  const [extraDesc, setExtraDesc] = useState('')

  const [reservando, setReservando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const buscar = useBuscarVuelos()
  const { data: dolar } = useParametrosDolar()

  const opcionesFiltradas = useMemo(() => {
    let arr = [...opcionesData]
    if (modoFiltro === 'sin-escala') {
      arr = arr.filter((o) => cantidadEscalas(o.escalas) === 0)
    } else if (modoFiltro === 'precio-bajo') {
      arr.sort((a, b) => a.precio - b.precio)
    } else if (modoFiltro === 'mejor-precio') {
      arr.sort((a, b) => {
        const sa = a.precio + cantidadEscalas(a.escalas) * 200
        const sb = b.precio + cantidadEscalas(b.escalas) * 200
        return sa - sb
      })
    }
    return arr
  }, [opcionesData, modoFiltro])

  const seleccion = seleccionIdx != null ? opcionesFiltradas[seleccionIdx] : null

  // Precio manual gana si se cargó; si no, se sugiere cantidad × USD 75
  // (mismo criterio que la vista previa del vanilla). Se usa este valor
  // "efectivo" en el config que viaja a ReservarModal/useCrearCotizacionDesdeVuelo
  // para que el total mostrado y el guardado en la cotización coincidan.
  const valijasPrecioEfectivo =
    valijasPrecio > 0 ? valijasPrecio : cantidadValijas > 0 ? cantidadValijas * VALIJA_PRECIO_SUGERIDO : 0

  const config: ConfigReserva = {
    personas,
    clase,
    cantidadValijas,
    valijasPrecio: valijasPrecioEfectivo,
    valijasDesc,
    extraPrecio,
    extraDesc,
  }

  const precioVuelo = seleccion ? seleccion.precio * personas : 0
  const precioValijas = valijasPrecioEfectivo
  const totalUSD = seleccion ? precioVuelo + precioValijas + (extraPrecio || 0) : 0

  async function onBuscar() {
    setBuscarError(null)
    setSinResultados(null)
    setSeleccionIdx(null)
    try {
      const opciones = await buscar.mutateAsync({ origenTexto, destinoTexto, fechaIda, fechaVuelta, clase, adultos: personas })
      setOpcionesData(opciones)
      if (opciones.length === 0) {
        setSinResultados('No encontré vuelos para esas fechas. Probá con otras.')
      }
    } catch (e) {
      setOpcionesData([])
      setBuscarError((e as ApiError).message || 'Error al buscar vuelos.')
    }
  }

  function toggleChip(nombre: Exclude<ModoFiltro, null>) {
    setSeleccionIdx(null)
    setModoFiltro((actual) => (actual === nombre ? null : nombre))
  }

  function onReservada(numeroCotizacion: string) {
    setReservando(false)
    setAviso(
      `Cotización ${numeroCotizacion} creada en estado PENDIENTE. Confirmala desde el panel de Cotizaciones cuando quieras.`,
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[var(--text)]">Calculadora de Vuelos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Filtrá, elegí y generá tu cotización en segundos.</p>
        </div>

        {dolar && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs">
            <span className="font-semibold uppercase tracking-wide text-[var(--text-muted)]">Dólar hoy</span>
            <span className="text-[var(--text)]">Oficial {dolar.oficial}</span>
            <span className="text-[var(--text)]">Blue {dolar.blue}</span>
            <span className="text-[var(--text)]">Tarjeta {dolar.tarjeta}</span>
            {dolar.actualizadoEl && <span className="text-[var(--text-muted)]">· {dolar.actualizadoEl}</span>}
          </div>
        )}
      </div>

      {aviso && (
        <div className="flex items-center justify-between rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text)] shadow-soft">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Búsqueda */}
      <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
        <h2 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
          <Search className="h-3.5 w-3.5" /> Búsqueda
        </h2>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <Calendar className="h-3 w-3" /> Fecha de ida
            </label>
            <input type="date" className={inputClass} value={fechaIda} onChange={(e) => setFechaIda(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <Calendar className="h-3 w-3" /> Fecha de regreso
            </label>
            <input
              type="date"
              className={inputClass}
              value={fechaVuelta}
              onChange={(e) => setFechaVuelta(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <PlaneTakeoff className="h-3 w-3" /> Lugar de salida
            </label>
            <input
              className={inputClass}
              value={origenTexto}
              onChange={(e) => setOrigenTexto(e.target.value)}
              placeholder="Ej: Mendoza"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <PlaneLanding className="h-3 w-3" /> Lugar de llegada
            </label>
            <input
              className={inputClass}
              value={destinoTexto}
              onChange={(e) => setDestinoTexto(e.target.value)}
              placeholder="Ej: Miami"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <Plane className="h-3 w-3" /> Clase
            </label>
            <select className={inputClass} value={clase} onChange={(e) => setClase(e.target.value as ClaseVuelo)}>
              {CLASES_VUELO.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button className={chipClass(modoFiltro === 'mejor-precio')} onClick={() => toggleChip('mejor-precio')}>
            <DollarSign className="h-3.5 w-3.5" /> Mejor precio
          </button>
          <button className={chipClass(modoFiltro === 'sin-escala')} onClick={() => toggleChip('sin-escala')}>
            <Target className="h-3.5 w-3.5" /> Sin escala
          </button>
          <button className={chipClass(modoFiltro === 'precio-bajo')} onClick={() => toggleChip('precio-bajo')}>
            <TrendingDown className="h-3.5 w-3.5" /> Precio más bajo
          </button>
        </div>

        <button
          onClick={onBuscar}
          disabled={buscar.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
        >
          {buscar.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" /> Buscar vuelos
            </>
          )}
        </button>
      </div>

      {/* Resultados */}
      <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
        <h2 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
          <Plane className="h-3.5 w-3.5" /> Opciones de vuelo
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--text-muted)]">
                <th className="py-2"></th>
                <th className="py-2">Aerolínea</th>
                <th className="py-2">Viaje</th>
                <th className="py-2">Precio USD</th>
                <th className="py-2">Precio $</th>
                <th className="py-2">Escalas</th>
              </tr>
            </thead>
            <tbody>
              {buscar.isPending ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                    Consultando Google Flights (5 fechas)…
                  </td>
                </tr>
              ) : buscarError ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-red-600">
                    <span className="inline-flex items-center gap-1.5">
                      <CircleAlert className="h-3.5 w-3.5" /> {buscarError}
                    </span>
                  </td>
                </tr>
              ) : sinResultados ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                      <FrownIcon className="h-3.5 w-3.5" /> {sinResultados}
                    </span>
                  </td>
                </tr>
              ) : opcionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[var(--text-muted)]">
                    {opcionesData.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <TriangleAlert className="h-3.5 w-3.5" /> Ningún vuelo cumple ese filtro. Probá destildarlo o
                        cambiar fechas.
                      </span>
                    ) : (
                      'Usá los filtros para buscar vuelos disponibles.'
                    )}
                  </td>
                </tr>
              ) : (
                opcionesFiltradas.map((o, idx) => (
                  <tr key={idx} className={o.esMasBarata ? 'bg-[var(--accent)]/5' : ''}>
                    <td className="py-2">
                      <input
                        type="radio"
                        name="vuelo-sel"
                        checked={seleccionIdx === idx}
                        onChange={() => setSeleccionIdx(idx)}
                        className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                      />
                    </td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1">
                        <strong className="text-[var(--text)]">{o.aerolinea}</strong>
                        {o.esMasBarata && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                      </span>
                    </td>
                    <td className="py-2 text-xs">
                      <div className="text-[var(--accent)]">
                        {o.origenIATA} → {o.destinoIATA}
                      </div>
                      <div className="text-[var(--text-muted)]">
                        {o.fechaIda} → {o.fechaVuelta} ({o.noches}n)
                      </div>
                      <div className="text-[var(--text-muted)]">{o.etiqueta}</div>
                    </td>
                    <td className="py-2">
                      <strong className="text-[var(--accent)]">{fmt(o.precio, 'USD ')}</strong>
                    </td>
                    <td className="py-2 text-[var(--text-muted)]">{fmt(Math.round(o.precio * 1100), '$ ')}</td>
                    <td className="py-2 text-xs text-[var(--text-muted)]">{o.escalas}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuración de la reserva */}
      <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
        <h2 className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--accent)]">
          <Settings className="h-3.5 w-3.5" /> Configuración de la reserva
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <FileText className="h-3 w-3" /> Extras (descripción)
            </label>
            <input
              className={inputClass}
              value={extraDesc}
              onChange={(e) => setExtraDesc(e.target.value)}
              placeholder="Ej: Seguro de viaje"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <DollarSign className="h-3 w-3" /> Extras (USD)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              className={inputClass}
              value={extraPrecio || ''}
              onChange={(e) => setExtraPrecio(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <Briefcase className="h-3 w-3" /> Valijas (descripción)
            </label>
            <input
              className={inputClass}
              value={valijasDesc}
              onChange={(e) => setValijasDesc(e.target.value)}
              placeholder="Ej: 2 valijas de 23kg"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <Briefcase className="h-3 w-3" /> Valijas (USD)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              className={inputClass}
              value={valijasPrecio || ''}
              onChange={(e) => setValijasPrecio(parseFloat(e.target.value) || 0)}
              placeholder={`vacío = auto (cantidad × USD ${VALIJA_PRECIO_SUGERIDO})`}
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <Briefcase className="h-3 w-3" /> Valijas (cantidad)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={cantidadValijas || ''}
              onChange={(e) => setCantidadValijas(parseInt(e.target.value, 10) || 0)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
              <Users className="h-3 w-3" /> Personas
            </label>
            <select
              className={inputClass}
              value={personas}
              onChange={(e) => setPersonas(parseInt(e.target.value, 10))}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} persona{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="rounded-xl2 border border-[var(--border)] bg-[var(--surface)] p-5 shadow-soft">
        <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Precio total estimado</p>
        <p className="mt-1 font-heading text-3xl font-bold text-[var(--accent)]">USD {totalUSD.toFixed(2)}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {seleccion ? (
            <>
              Vuelo ({fmt(seleccion.precio, 'USD ')} × {personas} persona{personas > 1 ? 's' : ''}) = USD{' '}
              {precioVuelo.toFixed(2)}
              {precioValijas > 0 &&
                (valijasPrecio > 0
                  ? ` + Valijas (USD ${precioValijas.toFixed(2)})`
                  : ` + Valijas (${cantidadValijas} × USD ${VALIJA_PRECIO_SUGERIDO}) = USD ${precioValijas.toFixed(2)}`)}
              {extraPrecio > 0 && ` + Extras (USD ${extraPrecio.toFixed(2)})`}
            </>
          ) : (
            'Seleccioná un vuelo para calcular.'
          )}
        </p>
      </div>

      <button
        onClick={() => {
          if (!seleccion) return
          setReservando(true)
        }}
        disabled={!seleccion}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-40"
      >
        <Ticket className="h-4 w-4" /> Reservar
      </button>

      {reservando && seleccion && (
        <ReservarModal
          opcion={seleccion}
          config={config}
          totalUSD={totalUSD}
          onClose={() => setReservando(false)}
          onCreada={onReservada}
        />
      )}
    </div>
  )
}
