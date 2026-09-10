// =====================================================
// Datos + mutaciones de Reservas vía TanStack Query.
// Paridad con Front vanilla Reservas.js: lista con auto-refresh
// (toggle, equivalente a refetchInterval condicional), editar
// (PUT monto/tipo/estado), registrar pago (PATCH /pago, atómico
// en el back vía increment), confirmar (PATCH /confirmar) y
// eliminar (DELETE → baja lógica).
//
// CrearReservaInput/useCrearReserva ya existían (usados por
// ConfirmarReservaModal.tsx en Cotizaciones) y se mantienen acá.
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { TipoReserva } from '../types/cotizacion'
import type { EstadoReserva, ReservaCompleta } from '../types/reserva'

const QUERY_KEY = ['reservas']

export interface CrearReservaInput {
  clienteId: string
  cotizacionId: string
  tipoReserva: TipoReserva
  montoFinal: number
  observaciones?: string
}

export interface ReservaCreada {
  id: string
  numeroReserva: string
}

export function useCrearReserva() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CrearReservaInput) => apiClient.post<ReservaCreada>('/reservas', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
    },
  })
}

export function useReservas(autoRefresh: boolean) {
  return useQuery<ReservaCompleta[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ReservaCompleta[]>('/reservas')
      return data
    },
    refetchInterval: autoRefresh ? 5_000 : false, // paridad con el toggle "Auto-refresh: ON (5s)" del vanilla
  })
}

// GET /reservas/:id (detalle) — incluye pasajeros/pagos/documentos, que la
// lista plana de arriba no trae. Usado por GestionReservaModal.
export function useReservaDetalle(id: string | undefined) {
  return useQuery<ReservaCompleta>({
    queryKey: [...QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await apiClient.get<ReservaCompleta>(`/reservas/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export interface ActualizarReservaInput {
  montoFinal?: number
  estado?: EstadoReserva
  tipoReserva?: TipoReserva
  observaciones?: string | null
}

export function useActualizarReserva() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActualizarReservaInput }) =>
      apiClient.put<ReservaCompleta>(`/reservas/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useRegistrarPago() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, monto }: { id: string; monto: number }) =>
      apiClient.patch<ReservaCompleta>(`/reservas/${id}/pago`, { monto }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useConfirmarReserva() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.patch<ReservaCompleta>(`/reservas/${id}/confirmar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useEliminarReserva() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/reservas/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
