// =====================================================
// Datos + mutaciones de Clientes vía TanStack Query.
// CRUD completo: GET lista, POST alta, PUT edición, DELETE (baja lógica
// en el back, ver Back/TSG-Backend/src/routes/clientes.ts).
// Paridad con Cliente.js vanilla: botón "Actualizar" (refetch manual) +
// toggle "Auto-refresh cada 5s" (mismo patrón que useReservas/useRecordatorios).
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { ClienteCompleto } from '../types/cliente'
import type { ClienteInput } from '../schemas/cliente.schema'

const QUERY_KEY = ['clientes']

export function useClientes(autoRefresh: boolean) {
  return useQuery<ClienteCompleto[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ClienteCompleto[]>('/clientes')
      return data
    },
    refetchInterval: autoRefresh ? 5_000 : false, // paridad con "Auto-refresh ON/OFF cada 5s" del vanilla
  })
}

export function useCrearCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ClienteInput) => apiClient.post<ClienteCompleto>('/clientes', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useActualizarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClienteInput }) =>
      apiClient.put<ClienteCompleto>(`/clientes/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useEliminarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/clientes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
