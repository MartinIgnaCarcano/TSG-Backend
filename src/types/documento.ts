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
  url: string
  hash: string
  aceptado: boolean
  fechaAceptacion: string | null
  medioAceptacion: string | null
  alta: string
}
