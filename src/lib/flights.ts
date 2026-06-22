// =====================================================
// Búsqueda de vuelos (RapidAPI google-flights2)
// Genera 5 variantes de fechas (-2…+2 días) en paralelo
// y devuelve una comparativa. Usado por /api/calculadora/buscar.
// =====================================================
import axios from 'axios'

const MOCK = process.env.MOCK_FLIGHTS === 'true' || !process.env.RAPIDAPI_KEY
const HOST = process.env.RAPIDAPI_FLIGHTS_HOST || 'google-flights2.p.rapidapi.com'

export interface OpcionVuelo {
  esOriginal: boolean
  etiqueta: string
  fechaIda: string
  fechaVuelta: string
  noches: number
  precio: number
  aerolinea: string
  escalas: string
  esMasBarata: boolean
}

export interface ParamsBusqueda {
  origenIATA: string
  destinoIATA: string
  fechaIda: string   // YYYY-MM-DD
  fechaVuelta: string
}

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function buscarUnaCombinacion(
  origenIATA: string,
  destinoIATA: string,
  ida: string,
  vuelta: string,
): Promise<{ precio: number; aerolinea: string; escalas: string } | null> {
  if (MOCK) return null

  // Retry simple inline: 2 intentos con 1.5s entre ellos
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
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
      const data = r.data

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
      const status = e?.response?.status
      const retriable = !status || status === 429 || (status >= 500 && status < 600)
      console.warn(`[flights] intento ${attempt} ${ida}→${vuelta}: ${e.message}`)
      if (attempt === 2 || !retriable) return null
      await sleep(1500)
    }
  }
  return null
}

/**
 * Hasta 5 opciones comparativas alrededor de las fechas pedidas.
 */
export async function buscarComparativa(datos: ParamsBusqueda): Promise<OpcionVuelo[]> {
  if (MOCK) return mockComparativa(datos)

  const offsets = [-2, -1, 0, 1, 2]
  const promesas = offsets.map(async (off) => {
    const nuevaIda = sumarDias(datos.fechaIda, off)
    const nuevaVuelta = sumarDias(datos.fechaVuelta, off)
    const n = noches(nuevaIda, nuevaVuelta)
    if (n <= 0) return null

    const r = await buscarUnaCombinacion(datos.origenIATA, datos.destinoIATA, nuevaIda, nuevaVuelta)
    if (!r) return null

    const etiqueta =
      off === 0 ? '📅 Fecha Elegida'
      : off === -2 ? '💡 -2 días'
      : off === -1 ? '💡 -1 día'
      : off === 1 ? '💡 +1 día'
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

  const precioMin = Math.min(...resultados.map((r) => r.precio))
  resultados.forEach((r) => { r.esMasBarata = r.precio === precioMin })

  resultados.sort((a, b) => {
    if (a.esOriginal) return -1
    if (b.esOriginal) return 1
    return a.precio - b.precio
  })

  return resultados
}

// ------------------------------------------------------------------
// MOCK — datos hardcodeados realistas para cuando no hay RAPIDAPI_KEY
// ------------------------------------------------------------------
function mockComparativa(d: ParamsBusqueda): OpcionVuelo[] {
  const base = 850 + Math.floor(Math.random() * 200)
  const aerolineas = ['Aerolíneas Argentinas', 'LATAM', 'Iberia', 'American Airlines', 'Delta']
  const escalasOpciones = ['Directo ✅', '1 escala: GRU', '1 escala: SCL', '2 escalas: LIM → MIA']
  const offsets = [0, -2, -1, 1, 2]
  const opciones: OpcionVuelo[] = offsets.map((off, i) => {
    const ida = sumarDias(d.fechaIda, off)
    const vuelta = sumarDias(d.fechaVuelta, off)
    return {
      esOriginal: off === 0,
      etiqueta: off === 0 ? '📅 Fecha Elegida' : off < 0 ? `💡 ${off} días` : `💡 +${off} días`,
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
