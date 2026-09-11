// =====================================================
// Catálogo de Hoteles. useHoteles() (lectura simple) ya existía y la
// usa HotelModal (cotizaciones) — se mantiene intacta. Se agregan acá
// el CRUD completo de la página Hoteles y la búsqueda externa (Flujo 6 de
// n8n), que ahora pasa por el back: POST /api/hoteles/buscar-externo.
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { Hotel } from '../types/cotizacion'
import type { DestinoCompleto, HotelCompleto } from '../types/hotel'
import type { HotelInput } from '../schemas/hotel.schema'

const QUERY_KEY = ['hoteles']

export function useHoteles() {
  return useQuery<Hotel[]>({
    queryKey: ['hoteles'],
    queryFn: async () => {
      const { data } = await apiClient.get<Hotel[]>('/hoteles')
      return data
    },
  })
}

// Catálogo completo (con destino.pais, rating, fuente, etc.) para la página Hoteles.
export function useHotelesCompletos() {
  return useQuery<HotelCompleto[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<HotelCompleto[]>('/hoteles')
      return data
    },
  })
}

export function useDestinos() {
  return useQuery<DestinoCompleto[]>({
    queryKey: ['destinos'],
    queryFn: async () => {
      const { data } = await apiClient.get<DestinoCompleto[]>('/destinos')
      return data
    },
  })
}

export function useCrearHotel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: HotelInput) => apiClient.post<HotelCompleto>('/hoteles', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useActualizarHotel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: HotelInput }) =>
      apiClient.put<HotelCompleto>(`/hoteles/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useEliminarHotel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/hoteles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export interface BuscarFlujo6Params {
  destinoId: string
  /** Texto para Booking; si va vacío el back usa el nombre del destino. */
  ciudad?: string
  checkin: string
  checkout: string
  adults: number
  rooms: number
  estrellasMin?: number
  precioMax?: number
}

export interface BuscarFlujo6Resultado {
  ok: boolean
  destino: { id: string; nombre: string; codigoIATA: string }
  encontrados: number
  creados: number
  actualizados: number
  descartados: number
}

// Antes le pegaba directo al webhook de n8n desde el navegador (con
// VITE_N8N_BASE, que en el deploy quedaba en localhost:5678) y después
// hacía polling a ciegas. Ahora el back llama a n8n, espera el resultado
// y devuelve cuántos hoteles se guardaron; se refresca el catálogo una vez.
export function useBuscarFlujo6() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: BuscarFlujo6Params) => {
      const { data } = await apiClient.post<BuscarFlujo6Resultado>('/hoteles/buscar-externo', params, {
        timeout: 60_000,
      })
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
