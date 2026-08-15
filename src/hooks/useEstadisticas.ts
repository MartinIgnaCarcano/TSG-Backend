// =====================================================
// Fase M1 (front) — hook único para GET /api/estadisticas.
// refetchInterval moderado (60s): son agregados de negocio, no
// necesitan el mismo polling de 30s que las listas del Dashboard.
// =====================================================
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { Estadisticas } from '../types/estadisticas'

const REFRESH_MS = 60_000

export function useEstadisticas() {
  return useQuery<Estadisticas>({
    queryKey: ['estadisticas'],
    queryFn: async () => {
      const { data } = await apiClient.get<Estadisticas>('/estadisticas')
      return data
    },
    refetchInterval: REFRESH_MS,
  })
}
