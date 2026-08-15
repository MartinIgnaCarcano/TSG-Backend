// =====================================================
// Datos del Dashboard vía TanStack Query.
// Refleja Front/STG-Sistema-de-gesti-n-de-viajes-/Dashboard.js:
// 5 queries en paralelo (clientes, reservas, cotizaciones,
// parametros, recordatorios), todas en modo "array plano"
// (sin ?page/?pageSize) para no tener que paginar en el Dashboard.
// =====================================================
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { Cliente, Cotizacion, Parametro, Recordatorio, Reserva } from '../types/dashboard'

const REFRESH_MS = 30_000 // mismo intervalo que el auto-refresh del front vanilla

function useArrayQuery<T>(key: string, path: string) {
  return useQuery<T[]>({
    queryKey: [key],
    queryFn: async () => {
      const { data } = await apiClient.get<T[]>(path)
      return data
    },
    refetchInterval: REFRESH_MS,
  })
}

export function useDashboardData() {
  const clientes = useArrayQuery<Cliente>('clientes', '/clientes')
  const reservas = useArrayQuery<Reserva>('reservas', '/reservas')
  const cotizaciones = useArrayQuery<Cotizacion>('cotizaciones', '/cotizaciones')
  const parametros = useArrayQuery<Parametro>('parametros', '/parametros')
  const recordatorios = useArrayQuery<Recordatorio>('recordatorios', '/recordatorios')

  const isLoading =
    clientes.isLoading ||
    reservas.isLoading ||
    cotizaciones.isLoading ||
    parametros.isLoading ||
    recordatorios.isLoading

  // Si alguna falla (back caído, etc.) no rompemos el resto: cada lista
  // cae a [] y el render de esa sección muestra su estado vacío.
  return {
    isLoading,
    clientes: clientes.data ?? [],
    reservas: reservas.data ?? [],
    cotizaciones: cotizaciones.data ?? [],
    parametros: parametros.data ?? [],
    recordatorios: recordatorios.data ?? [],
  }
}
