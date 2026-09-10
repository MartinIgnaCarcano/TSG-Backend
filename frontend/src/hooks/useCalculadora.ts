// =====================================================
// Hooks de la Calculadora, portados de
// Front/STG-Sistema-de-gesti-n-de-viajes-/Calculadora.js:
//   - resolverDestino: nombre o IATA -> destino del back (/destinos?q=)
//   - useBuscarVuelos: POST /calculadora/buscar (Google Flights, 5 fechas)
//   - useCrearCotizacionDesdeVuelo: cliente (buscar/crear) + viaje + tramos
//     + cotización PENDIENTE, en una sola mutation encadenada
//   - useParametrosDolar: widget de dólar (oficial/blue/tarjeta)
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { Parametro } from '../types/dashboard'
import type { ClienteCompleto } from '../types/cliente'
import type {
  ClaseVuelo,
  ConfigReserva,
  CotizacionCreada,
  DatosClienteReserva,
  DestinoResuelto,
  OpcionVuelo,
} from '../types/calculadora'

async function resolverDestino(texto: string): Promise<DestinoResuelto> {
  const t = (texto || '').trim()
  if (!t) throw new Error('Falta origen/destino')
  const { data } = await apiClient.get<DestinoResuelto[]>('/destinos', { params: { q: t } })
  if (!data || data.length === 0) {
    throw new Error(
      `No encontré ningún destino que coincida con "${t}". Probá con el código IATA (ej: MDZ) o el nombre completo (ej: Mendoza).`,
    )
  }
  return data[0]
}

export interface BuscarVuelosInput {
  origenTexto: string
  destinoTexto: string
  fechaIda: string
  fechaVuelta: string
  clase?: ClaseVuelo
  adultos?: number
}

export function useBuscarVuelos() {
  return useMutation({
    mutationFn: async (input: BuscarVuelosInput): Promise<OpcionVuelo[]> => {
      const { origenTexto, destinoTexto, fechaIda, fechaVuelta, clase, adultos } = input

      if (!fechaIda || !fechaVuelta) {
        throw new Error('Completá ambas fechas (ida y regreso).')
      }
      if (new Date(fechaVuelta) <= new Date(fechaIda)) {
        throw new Error('La fecha de regreso tiene que ser posterior a la de ida.')
      }

      const [origen, destino] = await Promise.all([
        resolverDestino(origenTexto),
        resolverDestino(destinoTexto),
      ])

      if (origen.codigoIATA === destino.codigoIATA) {
        throw new Error('Origen y destino no pueden ser iguales.')
      }

      const { data } = await apiClient.post<{ opciones: Omit<OpcionVuelo, 'origenIATA' | 'origenNombre' | 'destinoIATA' | 'destinoNombre'>[] }>(
        '/calculadora/buscar',
        {
          origenIATA: origen.codigoIATA,
          destinoIATA: destino.codigoIATA,
          fechaIda,
          fechaVuelta,
          ...(clase && { clase }),
          ...(adultos && adultos > 0 && { adultos }),
        },
      )

      return (data.opciones || []).map((o) => ({
        ...o,
        origenIATA: origen.codigoIATA,
        origenNombre: origen.nombre,
        destinoIATA: destino.codigoIATA,
        destinoNombre: destino.nombre,
      }))
    },
  })
}

interface CrearCotizacionDesdeVueloInput {
  opcion: OpcionVuelo
  config: ConfigReserva
  cliente: DatosClienteReserva
  totalUSD: number
}

export function useCrearCotizacionDesdeVuelo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CrearCotizacionDesdeVueloInput): Promise<CotizacionCreada & { cliente: ClienteCompleto }> => {
      const { opcion: o, config, cliente: datosCliente, totalUSD } = input
      const email = datosCliente.email.trim().toLowerCase()

      // 1) Buscar/crear cliente por email
      const { data: clientesExistentes } = await apiClient.get<ClienteCompleto[]>('/clientes')
      let cliente = (Array.isArray(clientesExistentes) ? clientesExistentes : []).find(
        (c) => c.email === email,
      )
      if (!cliente) {
        const { data } = await apiClient.post<ClienteCompleto>('/clientes', {
          nombre: datosCliente.nombre,
          apellido: datosCliente.apellido,
          email,
          telefono: datosCliente.telefono,
        })
        cliente = data
      }

      // 2) Resolver destinos por IATA
      const [origs, dests] = await Promise.all([
        apiClient.get<DestinoResuelto[]>('/destinos', { params: { iata: o.origenIATA } }),
        apiClient.get<DestinoResuelto[]>('/destinos', { params: { iata: o.destinoIATA } }),
      ])
      const origenId = origs.data[0]?.id
      const destinoId = dests.data[0]?.id
      if (!origenId || !destinoId) {
        throw new Error(
          `No encontré los destinos en la DB. Asegurate que ${o.origenIATA} y ${o.destinoIATA} existan en /api/destinos.`,
        )
      }

      // 3) Crear viaje + tramos
      const { data: viaje } = await apiClient.post<{ id: string }>('/viajes', {
        origenId,
        destinoId,
        tieneEscalas: !/Directo/i.test(o.escalas),
        descripcion: `${o.origenIATA} → ${o.destinoIATA} (${o.aerolinea}) — Calculadora`,
        tramos: [
          {
            origenId,
            destinoId,
            orden: 1,
            aerolinea: o.aerolinea,
            horaSalida: o.fechaIda + 'T08:00:00Z',
            horaLlegada: o.fechaIda + 'T20:00:00Z',
            completo: false,
          },
          {
            origenId: destinoId,
            destinoId: origenId,
            orden: 2,
            aerolinea: o.aerolinea,
            horaSalida: o.fechaVuelta + 'T08:00:00Z',
            horaLlegada: o.fechaVuelta + 'T20:00:00Z',
            completo: false,
          },
        ],
      })

      // 4) Parámetros (IVA / split ida-vuelta), con fallback si /parametros falla
      let ivaPorcentaje = 0.21
      let splitIdaVuelta = 0.5
      try {
        const { data: parametros } = await apiClient.get<Parametro[]>('/parametros')
        const lista = Array.isArray(parametros) ? parametros : []
        const iva = lista.find((p) => p.clave === 'IVA_PORCENTAJE')
        const split = lista.find((p) => p.clave === 'SPLIT_IDA_VUELTA')
        if (iva) ivaPorcentaje = Number(iva.valor)
        if (split) splitIdaVuelta = Number(split.valor)
      } catch {
        // back caído: seguimos con los defaults de siempre
      }

      // 5) Crear cotización PENDIENTE
      const obsExtras = [
        `Calculadora — ${o.aerolinea} — ${o.escalas}`,
        `${config.personas} persona${config.personas > 1 ? 's' : ''}`,
        config.valijasDesc ? `Valijas: ${config.valijasDesc} (USD ${config.valijasPrecio})` : '',
        config.extraDesc ? `Extras: ${config.extraDesc} (USD ${config.extraPrecio})` : '',
      ]
        .filter(Boolean)
        .join(' · ')

      // Texto descriptivo de extras (valijas + adicionales) y su costo total,
      // para las columnas reales de la cotización (clase/cantidadValijas/extras/precioExtras).
      const extrasDesc = [
        config.valijasDesc && `Valijas: ${config.valijasDesc}`,
        config.extraDesc && `Extras: ${config.extraDesc}`,
      ]
        .filter(Boolean)
        .join(' · ')
      const precioExtras = Math.round(((config.valijasPrecio || 0) + (config.extraPrecio || 0)) * 100) / 100

      const { data: cot } = await apiClient.post<CotizacionCreada>('/cotizaciones', {
        viajeId: viaje.id,
        clienteId: cliente.id,
        fechaVencimiento: new Date(Date.now() + 7 * 86400000).toISOString(),
        moneda: 'USD',
        precioIda: Math.round(totalUSD * splitIdaVuelta * 100) / 100,
        precioVuelta: Math.round(totalUSD * (1 - splitIdaVuelta) * 100) / 100,
        precioIdaYVuelta: totalUSD,
        impuestos: Math.round(totalUSD * ivaPorcentaje * 100) / 100,
        observaciones: obsExtras,
        clase: config.clase,
        cantidadValijas: config.cantidadValijas || 0,
        extras: extrasDesc || null,
        precioExtras,
      })

      return { ...cot, cliente }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}

export interface DolarWidget {
  oficial: string
  blue: string
  tarjeta: string
  actualizadoEl: string | null
}

function fmtDolar(p: Parametro | undefined): string {
  return p ? '$' + Number(p.valor).toLocaleString('es-AR') : '–'
}

export function useParametrosDolar() {
  return useQuery<DolarWidget>({
    queryKey: ['parametros-dolar'],
    queryFn: async () => {
      const { data } = await apiClient.get<Parametro[]>('/parametros')
      const get = (clave: string) => data.find((p) => p.clave === clave)
      const oficial = get('USD_OFICIAL')
      const blue = get('USD_BLUE')
      const tarjeta = get('USD_TARJETA')

      let actualizadoEl: string | null = null
      if (oficial?.descripcion) {
        const match = oficial.descripcion.match(/\d{4}-\d{2}-\d{2}/)
        if (match) actualizadoEl = match[0]
      }

      return {
        oficial: fmtDolar(oficial),
        blue: fmtDolar(blue),
        tarjeta: fmtDolar(tarjeta),
        actualizadoEl,
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}
