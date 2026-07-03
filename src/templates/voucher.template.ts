// =====================================================
// Plantilla HTML del voucher (Fase B). Mismo look & feel que el email de
// cotización (workflows/Bot_STG_Twilio_n8n.json) para que la identidad
// visual de los documentos de STG sea consistente. Se renderiza a HTML y
// lib/documentos.ts la convierte a PDF (PDFShift) o la guarda tal cual
// en modo mock.
//
// El snapshot se congela en DocumentoGenerado.datosSnapshot al emitir —
// el voucher no se vuelve a recalcular si después cambian Cliente,
// Pasajero o Reserva.
// =====================================================

export interface VoucherTramoSnapshot {
  origenIATA: string
  destinoIATA: string
  aerolinea: string | null
  horaSalida: string | null // ISO
  horaLlegada: string | null // ISO
}

export interface VoucherPasajeroSnapshot {
  nombre: string
  apellido: string
  documentoTipo: string
  documentoNumero: string
}

export interface VoucherHotelSnapshot {
  nombre: string
  direccion?: string | null
  estrellas: number
  noches?: number | null
}

export interface VoucherSnapshot {
  numeroReserva: string
  numeroVoucher: string
  version: number
  cliente: { nombre: string; apellido: string; email: string; telefono: string }
  pasajeros: VoucherPasajeroSnapshot[]
  origenNombre: string
  origenIATA: string
  destinoNombre: string
  destinoIATA: string
  tramos: VoucherTramoSnapshot[]
  hotel?: VoucherHotelSnapshot | null
  fechaViaje: string | null
  fechaRegreso: string | null
  montoFinal: number
  moneda: string
  fechaEmision: string
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtHora(iso: string | null): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function filaTramo(t: VoucherTramoSnapshot, i: number): string {
  return `
    <tr>
      <td style="padding:8px 0;color:#9ca3af;">Tramo ${i + 1}</td>
      <td><strong>${t.origenIATA} → ${t.destinoIATA}</strong></td>
      <td>${t.aerolinea ?? '–'}</td>
      <td>${fmtFecha(t.horaSalida)} ${fmtHora(t.horaSalida)}</td>
      <td>${fmtFecha(t.horaLlegada)} ${fmtHora(t.horaLlegada)}</td>
    </tr>`
}

function filaPasajero(p: VoucherPasajeroSnapshot): string {
  return `
    <tr>
      <td style="padding:6px 0;"><strong>${p.nombre} ${p.apellido}</strong></td>
      <td>${p.documentoTipo} ${p.documentoNumero}</td>
    </tr>`
}

export function construirVoucherHtml(s: VoucherSnapshot): string {
  const hotelHtml = s.hotel
    ? `<div style="background:#16213e;padding:15px;border-radius:8px;margin-top:16px;">
        <h3 style="color:#c8e44a;margin:0 0 8px;">🏨 Alojamiento</h3>
        <p style="margin:0;"><strong>${s.hotel.nombre}</strong> ${'⭐'.repeat(s.hotel.estrellas)}</p>
        ${s.hotel.direccion ? `<p style="margin:4px 0 0;color:#9ca3af;">${s.hotel.direccion}</p>` : ''}
        ${s.hotel.noches ? `<p style="margin:4px 0 0;color:#9ca3af;">${s.hotel.noches} noches</p>` : ''}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;background:#0f0f1a;">
  <div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;background:#1a1a2e;color:#eee;padding:30px;border-radius:12px;">
    <div style="text-align:center;margin-bottom:20px;">
      <h1 style="color:#c8e44a;margin:0;">✈️ Smart Booking STG</h1>
      <p style="color:#9ca3af;margin:4px 0;">Voucher de viaje</p>
    </div>

    <div style="background:#16213e;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h2 style="color:#c8e44a;margin-top:0;">Voucher ${s.numeroVoucher} <span style="color:#9ca3af;font-size:13px;">(v${s.version})</span></h2>
      <p style="margin:0;color:#9ca3af;">Reserva: <strong>${s.numeroReserva}</strong></p>
      <p style="margin:4px 0 0;color:#9ca3af;">Ruta: <strong>${s.origenNombre} (${s.origenIATA}) → ${s.destinoNombre} (${s.destinoIATA})</strong></p>
      <p style="margin:4px 0 0;color:#9ca3af;">Viaje: ${fmtFecha(s.fechaViaje)} → ${fmtFecha(s.fechaRegreso)}</p>
    </div>

    <div style="background:#16213e;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="color:#c8e44a;margin:0 0 10px;">🛫 Tramos</h3>
      <table style="width:100%;color:#eee;font-size:13px;border-collapse:collapse;">
        ${s.tramos.map(filaTramo).join('')}
      </table>
    </div>

    <div style="background:#16213e;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="color:#c8e44a;margin:0 0 10px;">🧳 Pasajeros</h3>
      <table style="width:100%;color:#eee;font-size:14px;border-collapse:collapse;">
        ${s.pasajeros.map(filaPasajero).join('')}
      </table>
    </div>

    ${hotelHtml}

    <div style="background:#16213e;padding:15px;border-radius:8px;margin-top:16px;">
      <p style="margin:0;color:#9ca3af;">Titular: <strong>${s.cliente.nombre} ${s.cliente.apellido}</strong> · ${s.cliente.email} · ${s.cliente.telefono}</p>
      <p style="margin:8px 0 0;color:#c8e44a;font-weight:bold;">Monto total: ${s.moneda} ${s.montoFinal}</p>
    </div>

    <div style="text-align:center;color:#6b7280;font-size:11px;margin-top:20px;">
      <p>Emitido el ${fmtFecha(s.fechaEmision)} — Smart Booking STG — Sistema de Gestión de Viajes</p>
      <p>Presentar este voucher junto con documento de identidad en el check-in.</p>
    </div>
  </div>
</body>
</html>`
}
