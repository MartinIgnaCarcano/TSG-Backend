// =====================================================
// Datos + mutaciones de Pagos (Fase D) vía TanStack Query.
// POST /api/pagos crea el Pago Y concilia la reserva (saldoPagado,
// recordatorios, estado) en una sola transacción del back.
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { Pago, PagoInput } from '../types/pago'
import type { ReservaCompleta } from '../types/reserva'

export function usePagos(reservaId: string | undefined) {
  return useQuery<Pago[]>({
    queryKey: ['pagos', reservaId],
    queryFn: async () => {
      const { data } = await apiClient.get<Pago[]>('/pagos', { params: { reservaId } })
      return data
    },
    enabled: !!reservaId,
  })
}

export function useCrearPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PagoInput) =>
      apiClient.post<{ pago: Pago; reserva: ReservaCompleta }>('/pagos', input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['pagos', input.reservaId] })
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
    },
  })
}

export function useEliminarPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; reservaId: string }) => apiClient.delete(`/pagos/${id}`),
    onSuccess: (_data, { reservaId }) => {
      queryClient.invalidateQueries({ queryKey: ['pagos', reservaId] })
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
    },
  })
}
