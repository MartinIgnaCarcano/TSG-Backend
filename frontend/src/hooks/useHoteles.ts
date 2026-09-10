// =====================================================
// Catálogo de Hoteles. useHoteles() (lectura simple) ya existía y la
// usa HotelModal (cotizaciones) — se mantiene intacta. Se agregan acá
// el CRUD completo de la página Hoteles y el disparo del Flujo 6 de n8n
// (búsqueda externa de hoteles vía webhook, fuera de la API del back).
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
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
  destinoNombre: string
  checkin: string
  checkout: string
  adults: number
  rooms: number
  estrellas?: string
  precioMax?: number
}

// Igual que Hoteles.js: dispara el webhook de n8n directo (no pasa por
// el back), y luego de cerrar el modal el caller hace polling 3x/8s.
const N8N_BASE = import.meta.env.VITE_N8N_BASE ?? 'http://localhost:5678'

export function useBuscarFlujo6() {
  return useMutation({
    mutationFn: (params: BuscarFlujo6Params) =>
      axios.post(`${N8N_BASE}/webhook/buscar-hoteles`, params),
  })
}
