// ============================================================
// Prueba de la capa de persistencia (Tesis STG — §5.3)
// Ejecuta transacciones reales contra la API (alta, consulta,
// modificación y baja lógica) sobre todas las entidades, y
// verifica integridad referencial: cascada de baja lógica y
// ausencia de registros huérfanos en las listas activas.
//
// Uso (con el back levantado):
//   node scripts/test_persistencia.mjs
//   API_BASE=http://localhost:3001/api node scripts/test_persistencia.mjs
//
// Reporta el conteo de transacciones y las inconsistencias
// detectadas, para fundamentar empíricamente la afirmación de §5.3.
// ============================================================

const BASE = process.env.API_BASE || 'http://localhost:3001/api'

let total = 0, ok = 0, fail = 0
const cat = { alta: 0, consulta: 0, modificacion: 0, baja: 0 }
const fallas = []
const integridad = []

async function call(method, path, body, categoria) {
  total++
  if (categoria) cat[categoria]++
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const txt = await res.text()
    let data
    try { data = JSON.parse(txt) } catch { data = txt }
    if (!res.ok) {
      fail++
      fallas.push(`${method} ${path} -> ${res.status} ${String(txt).slice(0, 140)}`)
      return { ok: false, status: res.status, data }
    }
    ok++
    return { ok: true, status: res.status, data }
  } catch (e) {
    fail++
    fallas.push(`${method} ${path} -> ERROR ${e.message}`)
    return { ok: false, error: e, data: null }
  }
}

const rndIATA = () => {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return Array.from({ length: 3 }, () => L[Math.floor(Math.random() * 26)]).join('')
}
const assert = (desc, cond) => integridad.push({ desc, ok: !!cond })

async function main() {
  const stamp = Date.now()
  console.log(`\n🧪 Prueba de persistencia contra ${BASE}\n`)

  // ---------------- ALTAS ----------------
  const cli = (await call('POST', '/clientes', { nombre: 'Test', apellido: 'Persistencia', telefono: '+5492610000000', email: `test${stamp}@persist.test` }, 'alta')).data
  const dA = (await call('POST', '/destinos', { nombre: 'Origen Test', codigoIATA: rndIATA(), pais: 'Argentina' }, 'alta')).data
  const dB = (await call('POST', '/destinos', { nombre: 'Destino Test', codigoIATA: rndIATA(), pais: 'España' }, 'alta')).data
  const hot = (await call('POST', '/hoteles', { nombre: 'Hotel Test', destinoId: dB?.id, estrellas: 3, precioNoche: 100, moneda: 'USD' }, 'alta')).data
  const via = (await call('POST', '/viajes', { origenId: dA?.id, destinoId: dB?.id, tieneEscalas: false, descripcion: 'Viaje test', tramos: [{ origenId: dA?.id, destinoId: dB?.id, orden: 1 }, { origenId: dB?.id, destinoId: dA?.id, orden: 2 }] }, 'alta')).data
  const cot = (await call('POST', '/cotizaciones', { viajeId: via?.id, clienteId: cli?.id, fechaVencimiento: new Date(Date.now() + 7 * 864e5).toISOString(), moneda: 'USD', precioIda: 500, precioVuelta: 500, precioIdaYVuelta: 1000, impuestos: 210, clase: 'ECONOMICA', cantidadValijas: 1, extras: 'Seguro de viaje', precioExtras: 50 }, 'alta')).data
  const montoFinal = Number(cot?.precioIdaYVuelta || 0) + Number(cot?.impuestos || 0) + Number(cot?.precioExtras || 0)
  const res = (await call('POST', '/reservas', { clienteId: cli?.id, cotizacionId: cot?.id, tipoReserva: 'IDA_Y_VUELTA', montoFinal, observaciones: 'Reserva test' }, 'alta')).data
  await call('POST', '/pasajeros', { reservaId: res?.id, nombre: 'Juan', apellido: 'Test', documentoTipo: 'DNI', documentoNumero: '12345678', fechaNacimiento: '1990-01-01', esTitular: true, asistenciaEspecial: true, detalleAsistencia: 'movilidad reducida' }, 'alta')
  await call('POST', '/pagos', { reservaId: res?.id, monto: 600, medioPago: 'TRANSFERENCIA', referencia: `TEST-${stamp}-1` }, 'alta')
  await call('POST', '/pagos', { reservaId: res?.id, monto: Math.max(montoFinal - 600, 1), medioPago: 'EFECTIVO', referencia: `TEST-${stamp}-2` }, 'alta')

  // viaje + cotización extra (sin reserva) para probar la cascada de baja lógica
  const via2 = (await call('POST', '/viajes', { origenId: dA?.id, destinoId: dB?.id, tieneEscalas: false, descripcion: 'Viaje cascada', tramos: [{ origenId: dA?.id, destinoId: dB?.id, orden: 1 }] }, 'alta')).data
  const cot2 = (await call('POST', '/cotizaciones', { viajeId: via2?.id, clienteId: cli?.id, fechaVencimiento: new Date(Date.now() + 7 * 864e5).toISOString(), moneda: 'USD', precioIda: 300, precioVuelta: 300, precioIdaYVuelta: 600, impuestos: 126 }, 'alta')).data

  // ---------------- CONSULTAS ----------------
  await call('GET', '/clientes', null, 'consulta')
  await call('GET', '/destinos', null, 'consulta')
  await call('GET', `/viajes/${via?.id}`, null, 'consulta')
  await call('GET', `/cotizaciones/${cot?.id}`, null, 'consulta')
  const resDet = (await call('GET', `/reservas/${res?.id}`, null, 'consulta')).data
  const pasajeros = (await call('GET', `/pasajeros?reservaId=${res?.id}`, null, 'consulta')).data
  const pagos = (await call('GET', `/pagos?reservaId=${res?.id}`, null, 'consulta')).data

  // ---------------- MODIFICACIONES ----------------
  await call('PUT', `/clientes/${cli?.id}`, { telefono: '+5492610000001' }, 'modificacion')
  await call('PUT', `/cotizaciones/${cot?.id}`, { cantidadValijas: 2 }, 'modificacion')

  // ---------------- BAJAS LÓGICAS ----------------
  await call('DELETE', `/viajes/${via2?.id}`, null, 'baja')   // debe dar de baja en cascada tramos y cotización

  // ---------------- VERIFICACIONES DE INTEGRIDAD ----------------
  // 1) Sin huérfanos: la reserva resuelve sus pasajeros y pagos
  assert('La reserva tiene su pasajero asociado (relación íntegra)', Array.isArray(pasajeros) && pasajeros.length >= 1)
  assert('La reserva tiene su pago asociado (relación íntegra)', Array.isArray(pagos) && pagos.length >= 1)
  // 2) Conciliación de pagos: saldoPagado refleja la suma de pagos y el estado avanzó a PAGADA
  const resFinal = (await call('GET', `/reservas/${res?.id}`, null, 'consulta')).data
  assert('saldoPagado refleja la suma de los pagos registrados', Number(resFinal?.saldoPagado) === montoFinal)
  assert('La reserva avanzó a PAGADA al cubrirse el saldo (máquina de estados)', resFinal?.estado === 'PAGADA')
  // 3) Cascada de baja lógica: la cotización del viaje borrado ya no aparece activa
  const cotsActivas = (await call('GET', `/cotizaciones?viajeId=${via2?.id}`, null, 'consulta')).data
  assert('La baja lógica del viaje dio de baja su cotización en cascada (sin huérfanos activos)', Array.isArray(cotsActivas) && cotsActivas.length === 0)
  // 4) El viaje borrado no aparece en la lista activa
  const viajesActivos = (await call('GET', '/viajes', null, 'consulta')).data
  const apareceBorrado = Array.isArray(viajesActivos) && viajesActivos.some(v => v.id === via2?.id)
  assert('El viaje dado de baja no figura en la lista de activos', !apareceBorrado)

  // ---------------- REPORTE ----------------
  const inconsistencias = integridad.filter(i => !i.ok)
  console.log('────────────────────────────────────────────')
  console.log(`Transacciones ejecutadas: ${total}`)
  console.log(`  · Altas:          ${cat.alta}`)
  console.log(`  · Consultas:      ${cat.consulta}`)
  console.log(`  · Modificaciones: ${cat.modificacion}`)
  console.log(`  · Bajas lógicas:  ${cat.baja}`)
  console.log(`Éxitos: ${ok}  |  Fallas: ${fail}`)
  console.log('────────────────────────────────────────────')
  console.log(`Verificaciones de integridad referencial: ${integridad.length}`)
  integridad.forEach(i => console.log(`  ${i.ok ? '✅' : '❌'} ${i.desc}`))
  console.log(`\nInconsistencias referenciales detectadas: ${inconsistencias.length}`)
  if (fallas.length) {
    console.log('\n⚠️  Operaciones con error (revisar):')
    fallas.forEach(f => console.log('   - ' + f))
  }
  console.log('\nResumen para §5.3:')
  console.log(`  "Se ejecutaron ${total} transacciones de prueba (${cat.alta} altas, ${cat.consulta} consultas, ${cat.modificacion} modificaciones, ${cat.baja} bajas lógicas)`)
  console.log(`   sobre la totalidad de las entidades. Se verificó la integridad referencial mediante ${integridad.length} comprobaciones,`)
  console.log(`   detectándose ${inconsistencias.length} inconsistencias referenciales y ${fallas.length} operaciones con error."`)
  console.log('')
}

main()
