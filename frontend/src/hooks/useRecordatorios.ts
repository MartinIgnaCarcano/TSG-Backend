// =====================================================
// Datos + mutaciones de Recordatorios vía TanStack Query.
// Paridad con Front vanilla Recordatorios.js: lista completa (sin
// query params, igual que el vanilla — el filtro pendientes/hoy/
// ejecutados/todos se hace en el cliente), ejecutar manualmente
// (PATCH /:id/ejecutar) y eliminar (DELETE definitivo, no baja lógica).
//
// useEnviarRecordatorio: el envío real por WhatsApp. El back dispara el
// Flujo3 de n8n y espera el resultado de Twilio, así el panel sabe si el
// mensaje salió o por qué no.
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { RecordatorioCompleto } from '../types/recordatorio'

const QUERY_KEY = ['recordatorios']

export function useRecordatorios(autoRefresh: boolean) {
  return useQuery<RecordatorioCompleto[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<RecordatorioCompleto[]>('/recordatorios')
      return data
    },
    refetchInterval: autoRefresh ? 10_000 : false, // paridad con "Auto: ON (10s)" del vanilla
  })
}

export function useEjecutarRecordatorio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/recordatorios/${id}/ejecutar`, { resultado: 'Ejecutado manualmente desde el front' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export interface ResultadoEnvio {
  ok: boolean
  detalle?: string
  sid?: string
}

export function useEnviarRecordatorio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ResultadoEnvio>(`/recordatorios/${id}/enviar`, undefined, {
        timeout: 40_000,
      })
      return data
    },
    // También en error: un envío fallido deja el motivo en `resultado`.
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useEliminarRecordatorio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/recordatorios/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
