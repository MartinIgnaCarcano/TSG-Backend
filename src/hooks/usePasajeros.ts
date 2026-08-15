// =====================================================
// Datos + mutaciones de Pasajeros (Fase B) vía TanStack Query.
// CRUD standalone contra /api/pasajeros, scoped por reservaId.
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { Pasajero, PasajeroInput } from '../types/pasajero'

export function usePasajeros(reservaId: string | undefined) {
  return useQuery<Pasajero[]>({
    queryKey: ['pasajeros', reservaId],
    queryFn: async () => {
      const { data } = await apiClient.get<Pasajero[]>('/pasajeros', { params: { reservaId } })
      return data
    },
    enabled: !!reservaId,
  })
}

export function useCrearPasajero() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PasajeroInput) => apiClient.post<Pasajero>('/pasajeros', input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['pasajeros', input.reservaId] })
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
    },
  })
}

export function useActualizarPasajero() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; reservaId: string; input: Partial<PasajeroInput> }) =>
      apiClient.put<Pasajero>(`/pasajeros/${id}`, input),
    onSuccess: (_data, { reservaId }) => {
      queryClient.invalidateQueries({ queryKey: ['pasajeros', reservaId] })
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
    },
  })
}

export function useEliminarPasajero() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; reservaId: string }) => apiClient.delete(`/pasajeros/${id}`),
    onSuccess: (_data, { reservaId }) => {
      queryClient.invalidateQueries({ queryKey: ['pasajeros', reservaId] })
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
    },
  })
}
