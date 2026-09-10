// =====================================================
// Datos + mutaciones de DocumentoGenerado (Fase B/C): listar, emitir
// voucher/contrato (POST /reservas/:id/voucher | /contrato) y aceptar
// (POST /documentos/:id/aceptar).
// =====================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/apiClient'
import type { DocumentoGenerado } from '../types/documento'

export function useDocumentos(reservaId: string | undefined) {
  return useQuery<DocumentoGenerado[]>({
    queryKey: ['documentos', reservaId],
    queryFn: async () => {
      const { data } = await apiClient.get<DocumentoGenerado[]>('/documentos', { params: { reservaId } })
      return data
    },
    enabled: !!reservaId,
  })
}

export function useEmitirVoucher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reservaId: string) => apiClient.post<DocumentoGenerado>(`/reservas/${reservaId}/voucher`),
    onSuccess: (_data, reservaId) => {
      queryClient.invalidateQueries({ queryKey: ['documentos', reservaId] })
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
    },
  })
}

export function useEmitirContrato() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reservaId: string) => apiClient.post<DocumentoGenerado>(`/reservas/${reservaId}/contrato`),
    onSuccess: (_data, reservaId) => {
      queryClient.invalidateQueries({ queryKey: ['documentos', reservaId] })
      queryClient.invalidateQueries({ queryKey: ['reservas'] })
    },
  })
}

export function useAceptarDocumento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, medio }: { id: string; reservaId: string; medio?: string }) =>
      apiClient.post<DocumentoGenerado>(`/documentos/${id}/aceptar`, { medio }),
    onSuccess: (_data, { reservaId }) => {
      queryClient.invalidateQueries({ queryKey: ['documentos', reservaId] })
    },
  })
}
