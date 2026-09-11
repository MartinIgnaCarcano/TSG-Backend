// =====================================================
// Tipos para DocumentoGenerado (Fase B/C): vouchers y contratos emitidos
// (PDF vía PDFShift, o .html si no hay PDFSHIFT_API_KEY configurada).
// =====================================================
export type TipoDocumento = 'VOUCHER' | 'CONTRATO'

export interface DocumentoGenerado {
  id: string
  reservaId: string
  tipo: TipoDocumento
  version: number
  // Nulo mientras el documento tiene el número de versión reservado
  // pero el archivo todavía no se generó (ver hallazgo A-2 del back).
  url: string | null
  hash: string | null
  aceptado: boolean
  fechaAceptacion: string | null
  medioAceptacion: string | null
  alta: string
}
