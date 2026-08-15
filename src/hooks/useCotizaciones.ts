// =====================================================
// Datos + mutaciones de Cotizaciones vía TanStack Query.
// Paridad con Front vanilla Cotizaciones.js: lista (con auto-refresh
// equivalente vía refetchInterval), confirmar reserva (PUT estado),
// agregar/quitar hotel (PUT hotelId/noches/precioHotel), cancelar
// (DELETE → baja lógica en el back).
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { CotizacionCompleta } from '../types/cotizacion'

const QUERY_KEY = ['cotizaciones']

export function useCotizaciones() {
  return useQuery<CotizacionCompleta[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<CotizacionCompleta[]>('/cotizaciones')
      return data
    },
    refetchInterval: 5_000, // paridad con el auto-refresh de 5s del vanilla
  })
}

export interface ActualizarCotizacionInput {
  estado?: 'PENDIENTE' | 'ENVIADA' | 'ACEPTADA' | 'VENCIDA'
  hotelId?: string | null
  noches?: number | null
  precioHotel?: number | null
}

export function useActualizarCotizacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActualizarCotizacionInput }) =>
      apiClient.put<CotizacionCompleta>(`/cotizaciones/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useCancelarCotizacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/cotizaciones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
