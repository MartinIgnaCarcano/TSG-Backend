// =====================================================
// Búsqueda de vuelos (RapidAPI google-flights2)
// Replica el "Smart Optimizer" del bot original: genera 5 variantes
// de fechas (-2…+2 días) y arma una comparativa.
// =====================================================
import axios from 'axios'
import { DatosViaje, OpcionVuelo } from './session'
import { withRetry, isHttpRetriable } from './retry'

const MOCK = process.env.MOCK_FLIGHTS === 'true' || !process.env.RAPIDAPI_KEY
const HOST = process.env.RAPIDAPI_FLIGHTS_HOST || 'google-flights2.p.rapidapi.com'

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(fechaISO + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().split('T')[0]
}

function noches(ida: string, vuelta: string): number {
  const a = new Date(ida + 'T00:00:00Z')
  const b = new Date(vuelta + 'T00:00:00Z')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

async function buscarUnaCombinacion(
  origenIATA: string,
  destinoIATA: string,
  ida: string,
  vuelta: string,
): Promise<{ precio: number; aerolinea: string; escalas: string } | null> {
  if (MOCK) return null // forzar mock más arriba

  try {
    const data = await withRetry(
      async () => {
        const r = await axios.get(`https://${HOST}/api/v1/searchFlights`, {
          params: {
            departure_id: origenIATA,
            arrival_id: destinoIATA,
            outbound_date: ida,
            return_date: vuelta,
            currency: 'USD',
          },
          headers: {
            'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
            'x-rapidapi-host': HOST,
          },
          timeout: 30000,
        })
        return r.data
      },
      {
        label: `flights ${ida}→${vuelta}`,
        maxAttempts: 2, // RapidAPI cobra por hit, no abusar
        baseDelayMs: 1500,
        isRetriable: isHttpRetriable,
      },
    )

    const topFlights = data?.data?.itineraries?.topFlights
    if (!Array.isArray(topFlights) || topFlights.length === 0) return null

    const f = topFlights[0]
    const precio = f.price
    if (!precio) return null

    const aerolinea =
      (Array.isArray(f.flights) && f.flights[0]?.airline) || 'Aerolínea'

    let escalas = 'Directo ✅'
    const cantTramos = Array.isArray(f.flights) ? f.flights.length : 1
    const cantEscalas = cantTramos - 1
    if (cantEscalas > 0) {
      escalas = cantEscalas === 1 ? '1 escala' : `${cantEscalas} escalas`
      if (Array.isArray(f.layovers) && f.layovers.length > 0) {
        const det = f.layovers.map((l: any) => l.airport_code).join(' → ')
        escalas = `${escalas}: ${det}`
      }
    }

    return { precio, aerolinea, escalas }
  } catch (e: any) {
    console.warn('[flights] error en combinación', ida, '→', vuelta, ':', e.message)
    return null
  }
}

/**
 * Devuelve hasta 5 opciones comparativas alrededor de las fechas pedidas.
 */
export async function buscarComparativa(
  datos: Required<Pick<DatosViaje, 'origenIATA' | 'destinoIATA' | 'fechaIda' | 'fechaVuelta'>>,
): Promise<OpcionVuelo[]> {
  if (MOCK) return mockComparativa(datos)

  const offsets = [-2, -1, 0, 1, 2]
  const promesas = offsets.map(async (off) => {
    const nuevaIda = sumarDias(datos.fechaIda, off)
    const nuevaVuelta = sumarDias(datos.fechaVuelta, off)
    const n = noches(nuevaIda, nuevaVuelta)
    if (n <= 0) return null

    const r = await buscarUnaCombinacion(
      datos.origenIATA,
      datos.destinoIATA,
      nuevaIda,
      nuevaVuelta,
    )
    if (!r) return null

    const etiqueta =
      off === 0
        ? '📅 Fecha Elegida'
        : off === -2
        ? '💡 -2 días'
        : off === -1
        ? '💡 -1 día'
        : off === 1
        ? '💡 +1 día'
        : '💡 +2 días'

    const opcion: OpcionVuelo = {
      esOriginal: off === 0,
      etiqueta,
      fechaIda: nuevaIda,
      fechaVuelta: nuevaVuelta,
      noches: n,
      precio: r.precio,
      aerolinea: r.aerolinea,
      escalas: r.escalas,
      esMasBarata: false,
    }
    return opcion
  })

  const resultados = (await Promise.all(promesas)).filter(
    (x): x is OpcionVuelo => x !== null,
  )
  if (resultados.length === 0) return []

  // Marcar la más barata
  const precioMin = Math.min(...resultados.map((r) => r.precio))
  resultados.forEach((r) => {
    r.esMasBarata = r.precio === precioMin
  })

  // Ordenar: original primera, después las demás por precio asc
  resultados.sort((a, b) => {
    if (a.esOriginal) return -1
    if (b.esOriginal) return 1
    return a.precio - b.precio
  })

  return resultados
}

// ------------------------------------------------------------------
// MOCK — datos hardcodeados realistas para que la demo funcione sin API
// ------------------------------------------------------------------
function mockComparativa(d: {
  origenIATA: string
  destinoIATA: string
  fechaIda: string
  fechaVuelta: string
}): OpcionVuelo[] {
  const base = 850 + Math.floor(Math.random() * 200)
  const aerolineas = ['Aerolíneas Argentinas', 'LATAM', 'Iberia', 'American Airlines', 'Delta']
  const escalasOpciones = ['Directo ✅', '1 escala: GRU', '1 escala: SCL', '2 escalas: LIM → MIA']
  const offsets = [0, -2, -1, 1, 2]
  const opciones: OpcionVuelo[] = offsets.map((off, i) => {
    const ida = sumarDias(d.fechaIda, off)
    const vuelta = sumarDias(d.fechaVuelta, off)
    return {
      esOriginal: off === 0,
      etiqueta:
        off === 0
          ? '📅 Fecha Elegida'
          : off < 0
          ? `💡 ${off} días`
          : `💡 +${off} días`,
      fechaIda: ida,
      fechaVuelta: vuelta,
      noches: noches(ida, vuelta),
      precio: base + off * 40 + i * 15,
      aerolinea: aerolineas[i % aerolineas.length],
      escalas: escalasOpciones[i % escalasOpciones.length],
      esMasBarata: false,
    }
  })
  const min = Math.min(...opciones.map((o) => o.precio))
  opciones.forEach((o) => (o.esMasBarata = o.precio === min))
  return opciones
}

/** Formato de texto para WhatsApp */
export function formatearComparativa(
  origen: string,
  destino: string,
  opciones: OpcionVuelo[],
): string {
  let m = `🔍 *COMPARATIVA DE VUELOS — STG*\n`
  m += `✈️ *${origen} → ${destino}*\n`
  m += `━━━━━━━━━━━━━━━━━━━━\n\n`
  opciones.forEach((o, i) => {
    const estrella = o.esMasBarata ? ' 🏆 *MEJOR PRECIO*' : ''
    m += `*${i + 1}. ${o.etiqueta}*${estrella}\n`
    m += `💰 *USD ${o.precio}* | ${o.escalas}\n`
    m += `🏢 ${o.aerolinea}\n`
    m += `📅 ${o.fechaIda} → ${o.fechaVuelta} (${o.noches} noches)\n`
    m += `────────────────────\n`
  })
  m += `\n📝 Para reservar, respondé con:\n`
  m += `*NUMERO | Nombre Apellido | email*\n\n`
  m += `_Ejemplo:_ \`1 | Juan Perez | juan@mail.com\``
  return m
}
