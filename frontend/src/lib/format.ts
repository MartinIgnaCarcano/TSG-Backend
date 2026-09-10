// Helpers de formato compartidos por las páginas del front.
// Portados 1:1 de Front/STG-Sistema-de-gesti-n-de-viajes-/Dashboard.js
// para mantener el mismo criterio de visualización (USD/K/M, $ AR, fechas es-AR).
//
// Los montos exactos usan instancias de Intl.NumberFormat armadas una sola
// vez a nivel de módulo (no en cada llamada) para el agrupamiento/decimales
// es-AR (punto de miles, coma decimal) — antes algunos lugares (GestionReservaModal,
// RegistrarPagoModal) armaban el monto a mano con `.toFixed(2)`, sin
// agrupamiento ni locale.
const nfEntero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const nfExacto = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function fmtMoneda(n: number | string | null | undefined): string {
  const num = Number(n)
  if (n == null || Number.isNaN(num)) return 'USD 0'
  if (num >= 1_000_000) return 'USD ' + (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return 'USD ' + (num / 1_000).toFixed(1) + 'K'
  return 'USD ' + num.toFixed(0)
}

export function fmtPesos(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '$ –'
  return '$ ' + nfEntero.format(n)
}

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

// Monto exacto (no abreviado a K/M), para tablas y modales donde sí
// importa el centavo — Cotizaciones, Reservas, GestionReservaModal,
// RegistrarPagoModal. Combinar con la clase `tabular-nums` para que los
// dígitos no salten de ancho en listas/columnas.
export function fmtMonedaExacta(n: number | string | null | undefined): string {
  if (n == null) return '–'
  const num = Number(n)
  if (Number.isNaN(num)) return '–'
  return 'USD ' + nfExacto.format(num)
}

// Fecha completa dd/mm/yyyy, para vencimientos y columnas de detalle.
export function fmtFechaLarga(iso: string | null | undefined): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('es-AR')
}

// Fecha + hora separadas, para columnas de "ida"/"vuelta" en Cotizaciones.
export function fechaHora(iso: string | null | undefined): { fecha: string; hora: string } {
  if (!iso) return { fecha: '–', hora: '' }
  const d = new Date(iso)
  return {
    fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
    hora: d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  }
}

const TIPO_RECORDATORIO_LABEL: Record<string, string> = {
  PAGO_SALDO: '💰 Pago saldo',
  CHECK_IN: '✈️ Check-in',
  POST_VIAJE: '🌟 Feedback',
  CLIMA: '☁️ Clima',
  VOUCHER: '🎫 Voucher',
}

export function tipoRecordatorioLabel(tipo: string): string {
  return TIPO_RECORDATORIO_LABEL[tipo] ?? tipo
}
