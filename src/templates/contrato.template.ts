// =====================================================
// Plantilla HTML del contrato de viaje (Fase C). Reutiliza DocumentoGenerado
// (tipo=CONTRATO) y el mismo pipeline de PDFShift/mock que el voucher.
//
// Cláusulas mínimas para una agencia de viajes en Argentina:
// - Ley 18.829 (agentes de viajes): identifica a la agencia como
//   intermediaria, deja constancia de los servicios contratados y
//   condiciones de cancelación.
// - Ley 24.240 (defensa del consumidor) + Resolución 256/2000: derecho
//   a revocar/reembolso según plazos, información clara de precios.
// - Ley 25.326 (protección de datos personales): consentimiento para el
//   uso de los datos del pasajero (DNI/pasaporte) sólo para emitir
//   voucher/boletos, sin cesión a terceros salvo a la línea aérea/hotel.
//
// El snapshot se congela igual que en el voucher: si después cambia el
// monto o el viaje, no se reescribe el contrato ya aceptado — se emite
// una versión nueva (version++) y la aceptación queda por versión.
// =====================================================

export interface ContratoPasajeroSnapshot {
  nombre: string
  apellido: string
  documentoTipo: string
  documentoNumero: string
}

export interface ContratoSnapshot {
  numeroReserva: string
  numeroContrato: string
  version: number
  cliente: { nombre: string; apellido: string; email: string; telefono: string }
  pasajeros: ContratoPasajeroSnapshot[]
  origenNombre: string
  destinoNombre: string
  fechaViaje: string | null
  fechaRegreso: string | null
  montoFinal: number
  saldoPagado: number
  moneda: string
  tipoReserva: string
  fechaEmision: string
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function construirContratoHtml(s: ContratoSnapshot): string {
  const saldoPendiente = s.montoFinal - s.saldoPagado

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;background:#fff;color:#1a1a2e;">
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:700px;margin:0 auto;padding:40px;line-height:1.5;">
    <div style="text-align:center;border-bottom:2px solid #1a1a2e;padding-bottom:16px;margin-bottom:24px;">
      <h1 style="margin:0;">Contrato de Servicios de Viaje</h1>
      <p style="color:#555;margin:4px 0;">Smart Booking STG — Contrato N° ${s.numeroContrato} (versión ${s.version})</p>
    </div>

    <p>Entre <strong>Smart Booking STG</strong>, en su carácter de agencia de viajes intermediaria
    (Ley 18.829), y <strong>${s.cliente.nombre} ${s.cliente.apellido}</strong> (en adelante, "el
    Cliente"), con email ${s.cliente.email} y teléfono ${s.cliente.telefono}, se celebra el presente
    contrato de servicios de viaje, referido a la Reserva N° <strong>${s.numeroReserva}</strong>,
    sujeto a las siguientes condiciones:</p>

    <h3>1. Objeto</h3>
    <p>La agencia se obliga a gestionar la reserva de viaje ${s.tipoReserva.replace('_', ' y ')}
    entre <strong>${s.origenNombre}</strong> y <strong>${s.destinoNombre}</strong>, con fecha de
    viaje estimada el <strong>${fmtFecha(s.fechaViaje)}</strong>
    ${s.fechaRegreso ? `y regreso el <strong>${fmtFecha(s.fechaRegreso)}</strong>` : ''}, para los
    pasajeros detallados en la cláusula 4.</p>

    <h3>2. Precio y forma de pago</h3>
    <p>El monto total acordado es de <strong>${s.moneda} ${s.montoFinal.toFixed(2)}</strong>.
    A la fecha de emisión de este contrato, el Cliente abonó <strong>${s.moneda}
    ${s.saldoPagado.toFixed(2)}</strong>, quedando un saldo pendiente de <strong>${s.moneda}
    ${saldoPendiente.toFixed(2)}</strong>, cuya conciliación queda registrada en el sistema de la
    agencia (módulo de pagos).</p>

    <h3>3. Cancelaciones y reembolsos</h3>
    <p>Las condiciones de cancelación y reembolso son las informadas por cada proveedor (aerolínea/
    hotel) al momento de la cotización, sin perjuicio de los derechos del Cliente conforme la Ley
    24.240 de Defensa del Consumidor.</p>

    <h3>4. Pasajeros</h3>
    <ul>
      ${s.pasajeros.map((p) => `<li>${p.nombre} ${p.apellido} — ${p.documentoTipo} ${p.documentoNumero}</li>`).join('')}
    </ul>

    <h3>5. Datos personales</h3>
    <p>El Cliente presta su consentimiento, conforme la Ley 25.326 de Protección de Datos
    Personales, para que los datos de los pasajeros (incluyendo documento de identidad) sean
    utilizados exclusivamente para la emisión de vouchers, boletos y demás documentación necesaria
    para el viaje, pudiendo ser compartidos únicamente con las aerolíneas y/o establecimientos
    hoteleros involucrados.</p>

    <h3>6. Aceptación</h3>
    <p>La aceptación de este contrato por parte del Cliente (registrada por la agencia con fecha y
    medio de aceptación) tiene el mismo valor que la firma del presente, conforme las prácticas
    habituales del comercio electrónico.</p>

    <div style="margin-top:40px;border-top:1px solid #ccc;padding-top:12px;color:#777;font-size:12px;">
      <p>Emitido el ${fmtFecha(s.fechaEmision)} — Smart Booking STG — Sistema de Gestión de Viajes.</p>
    </div>
  </div>
</body>
</html>`
}
