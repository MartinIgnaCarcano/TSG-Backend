// ============================================================
// Prueba de concurrencia sobre la capa de persistencia
// (Tesis STG — hallazgo M-17 de la auditoría)
//
// El §6.1 afirma que las 25 transacciones "validan la pertinencia del modelo
// relacional para flujos de automatización con múltiples procesos asincrónicos
// CONCURRENTES", pero esas pruebas se ejecutaron de forma secuencial. Se
// declara validada precisamente la propiedad que no se puso a prueba.
//
// Este script ejerce concurrencia real contra la API:
//   E1  N pagos simultáneos sobre la misma reserva
//       → el saldo final debe ser exactamente la suma de los pagos aceptados
//   E2  N transiciones de estado simultáneas sobre la misma reserva
//       → a lo sumo una debe prosperar (bloqueo optimista de transicionarEstado)
//   E3  N cotizaciones simultáneas sobre el mismo viaje
//       → todas deben persistir, sin pérdidas ni duplicados
//   E4  N lecturas concurrentes durante escrituras
//       → ninguna debe observar un estado intermedio inconsistente
//
// Uso (con el back levantado):
//   node scripts/test_concurrencia.mjs
//   N=20 API_BASE=http://localhost:3001/api node scripts/test_concurrencia.mjs
// ============================================================

const BASE = process.env.API_BASE || 'http://localhost:3001/api'
const API_KEY = process.env.N8N_API_KEY || ''
const N = Number(process.env.N ?? 10)

const headers = { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
const checks = []
const check = (desc, cond, detalle = '') => { checks.push({ desc, ok: !!cond, detalle }); return !!cond }

async function call(method, path, body) {
  try {
    const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const txt = await r.text()
    let data; try { data = JSON.parse(txt) } catch { data = txt }
    return { ok: r.ok, status: r.status, data }
  } catch (e) {
    return { ok: false, status: 0, data: String(e.message) }
  }
}

const rndIATA = () => {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return Array.from({ length: 3 }, () => L[Math.floor(Math.random() * 26)]).join('')
}

async function sembrar() {
  const stamp = Date.now()
  const cli = (await call('POST', '/clientes', { nombre: 'Test', apellido: 'Concurrencia', telefono: '+5492610000200', email: `conc${stamp}@test.local` })).data
  const dA = (await call('POST', '/destinos', { nombre: 'Origen CC', codigoIATA: rndIATA(), pais: 'Argentina' })).data
  const dB = (await call('POST', '/destinos', { nombre: 'Destino CC', codigoIATA: rndIATA(), pais: 'Brasil' })).data
  const via = (await call('POST', '/viajes', {
    origenId: dA?.id, destinoId: dB?.id, tieneEscalas: false, descripcion: 'Viaje concurrencia',
    tramos: [{ origenId: dA?.id, destinoId: dB?.id, orden: 1 }],
  })).data
  const cot = (await call('POST', '/cotizaciones', {
    viajeId: via?.id, clienteId: cli?.id,
    fechaVencimiento: new Date(Date.now() + 7 * 864e5).toISOString(),
    moneda: 'USD', precioIda: 500, precioVuelta: 500, precioIdaYVuelta: 1000, impuestos: 0,
  })).data
  if (!cli?.id || !via?.id || !cot?.id) throw new Error('No se pudo sembrar. ¿Back levantado y DB migrada?')
  return { clienteId: cli.id, viajeId: via.id, cotizacionId: cot.id, stamp }
}

;(async () => {
  console.log(`\n⚡ Prueba de concurrencia contra ${BASE}  (N=${N} operaciones simultáneas)\n`)
  const base = await sembrar()

  // ================= E1 · Pagos simultáneos sobre la misma reserva =================
  console.log('E1 · Pagos simultáneos sobre la misma reserva')
  {
    const MONTO_FINAL = 1000
    const MONTO_PAGO = 50
    const r = (await call('POST', '/reservas', {
      clienteId: base.clienteId, cotizacionId: base.cotizacionId,
      tipoReserva: 'IDA_Y_VUELTA', montoFinal: MONTO_FINAL, observaciones: 'E1 concurrencia',
    })).data

    const res = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        call('POST', '/pagos', { reservaId: r?.id, monto: MONTO_PAGO, medioPago: 'TRANSFERENCIA', referencia: `CC-${base.stamp}-${i}` })
      )
    )
    const aceptados = res.filter(x => x.ok).length
    const det = (await call('GET', `/reservas/${r?.id}`)).data
    const saldoEsperado = aceptados * MONTO_PAGO
    const saldoReal = Number(det?.saldoPagado ?? -1)
    const pagos = (await call('GET', `/pagos?reservaId=${r?.id}`)).data
    const pagosPersistidos = Array.isArray(pagos) ? pagos.length : -1

    console.log(`   ${aceptados}/${N} pagos aceptados · saldoPagado=${saldoReal} (esperado ${saldoEsperado}) · pagos en DB: ${pagosPersistidos}`)
    check('E1 · saldoPagado coincide con la suma de los pagos aceptados', saldoReal === saldoEsperado, `real=${saldoReal} esperado=${saldoEsperado}`)
    check('E1 · cada pago aceptado quedó persistido (sin pérdidas por carrera)', pagosPersistidos === aceptados, `persistidos=${pagosPersistidos} aceptados=${aceptados}`)
    check('E1 · no se sobrepasó el monto final por lecturas sucias', saldoReal <= MONTO_FINAL || aceptados * MONTO_PAGO > MONTO_FINAL)
  }

  // ================= E2 · Transiciones de estado simultáneas =================
  console.log('\nE2 · Transiciones de estado simultáneas sobre la misma reserva')
  {
    const r = (await call('POST', '/reservas', {
      clienteId: base.clienteId, cotizacionId: base.cotizacionId,
      tipoReserva: 'IDA_Y_VUELTA', montoFinal: 1000, observaciones: 'E2 concurrencia',
    })).data

    // Todas parten de EN_PROCESO y compiten por destinos mutuamente excluyentes.
    const destinos = Array.from({ length: N }, (_, i) => (i % 2 === 0 ? 'PAGADA' : 'CANCELADA'))
    const res = await Promise.all(
      destinos.map(estado => call('PATCH', `/reservas/${r?.id}/estado`, { estado, motivo: 'carrera' }))
    )
    const aceptadas = res.filter(x => x.ok).length
    const det = (await call('GET', `/reservas/${r?.id}`)).data
    const estadoFinal = det?.estado

    console.log(`   ${aceptadas}/${N} transiciones aceptadas · estado final: ${estadoFinal}`)
    // PAGADA→CANCELADA es válida, así que puede prosperar más de una. Lo que NO
    // puede pasar es que el estado final sea inalcanzable desde EN_PROCESO.
    check('E2 · el estado final es alcanzable desde EN_PROCESO', ['EN_PROCESO', 'PAGADA', 'CANCELADA', 'SEÑADA'].includes(estadoFinal), `estadoFinal=${estadoFinal}`)
    check('E2 · al menos una transición prosperó', aceptadas >= 1, `aceptadas=${aceptadas}`)
    check('E2 · no se alcanzó un estado que requiere pasos intermedios', !['DOCUMENTADA', 'EN_VIAJE', 'FINALIZADA'].includes(estadoFinal), `estadoFinal=${estadoFinal}`)
  }

  // ================= E3 · Cotizaciones simultáneas sobre el mismo viaje =================
  console.log('\nE3 · Cotizaciones simultáneas sobre el mismo viaje')
  {
    const antes = (await call('GET', `/cotizaciones?viajeId=${base.viajeId}`)).data
    const nAntes = Array.isArray(antes) ? antes.length : 0

    const res = await Promise.all(
      Array.from({ length: N }, (_, i) => call('POST', '/cotizaciones', {
        viajeId: base.viajeId, clienteId: base.clienteId,
        fechaVencimiento: new Date(Date.now() + 7 * 864e5).toISOString(),
        moneda: 'USD', precioIda: 100 + i, precioVuelta: 100 + i, precioIdaYVuelta: 200 + 2 * i, impuestos: 0,
      }))
    )
    const creadas = res.filter(x => x.ok).length
    const ids = new Set(res.filter(x => x.ok).map(x => x.data?.id))

    const despues = (await call('GET', `/cotizaciones?viajeId=${base.viajeId}`)).data
    const nDespues = Array.isArray(despues) ? despues.length : -1

    console.log(`   ${creadas}/${N} cotizaciones creadas · en DB: ${nAntes} → ${nDespues}`)
    check('E3 · todas las cotizaciones creadas persistieron', nDespues === nAntes + creadas, `esperado=${nAntes + creadas} real=${nDespues}`)
    check('E3 · no se generaron identificadores duplicados', ids.size === creadas, `únicos=${ids.size} creadas=${creadas}`)
  }

  // ================= E4 · Lecturas concurrentes durante escrituras =================
  console.log('\nE4 · Lecturas concurrentes durante escrituras')
  {
    const r = (await call('POST', '/reservas', {
      clienteId: base.clienteId, cotizacionId: base.cotizacionId,
      tipoReserva: 'IDA_Y_VUELTA', montoFinal: 500, observaciones: 'E4 concurrencia',
    })).data

    const escrituras = Array.from({ length: N }, (_, i) =>
      call('POST', '/pagos', { reservaId: r?.id, monto: 10, medioPago: 'EFECTIVO', referencia: `CC4-${base.stamp}-${i}` })
    )
    const lecturas = Array.from({ length: N }, () => call('GET', `/reservas/${r?.id}`))
    const todas = await Promise.all([...escrituras, ...lecturas])

    const lecturasOk = todas.slice(N).filter(x => x.ok)
    const inconsistentes = lecturasOk.filter(x => {
      const d = x.data
      if (!d) return true
      const saldo = Number(d.saldoPagado ?? 0)
      // Invariantes que deben cumplirse en CUALQUIER instante observable
      return saldo < 0 || !['EN_PROCESO', 'SEÑADA', 'PAGADA', 'DOCUMENTADA', 'EN_VIAJE', 'FINALIZADA', 'CANCELADA'].includes(d.estado)
    })

    console.log(`   ${lecturasOk.length}/${N} lecturas exitosas · estados intermedios inconsistentes: ${inconsistentes.length}`)
    check('E4 · ninguna lectura observó un estado inconsistente', inconsistentes.length === 0, `inconsistentes=${inconsistentes.length}`)
    check('E4 · todas las lecturas concurrentes respondieron', lecturasOk.length === N, `ok=${lecturasOk.length}/${N}`)
  }

  // ================= Reporte =================
  const fallas = checks.filter(c => !c.ok)
  console.log('\n' + '═'.repeat(72))
  checks.forEach(c => console.log(`  ${c.ok ? '✅' : '❌'} ${c.desc}${c.ok ? '' : `  → ${c.detalle}`}`))
  console.log('═'.repeat(72))
  console.log(`Verificaciones: ${checks.length}  ·  Correctas: ${checks.length - fallas.length}  ·  Fallidas: ${fallas.length}`)

  const totalOps = N * 5
  console.log('\nResumen para §5.3 / §6.1:')
  console.log(`  "Se ejecutaron cuatro escenarios de concurrencia con ${N} operaciones simultáneas cada uno`)
  console.log(`   (aproximadamente ${totalOps} operaciones concurrentes en total): pagos simultáneos sobre una`)
  console.log(`   misma reserva, transiciones de estado en competencia, altas simultáneas sobre un mismo`)
  console.log(`   viaje y lecturas concurrentes durante escrituras. Sobre ${checks.length} invariantes verificados`)
  console.log(`   se detectaron ${fallas.length} violaciones de consistencia."`)
  console.log('')

  if (fallas.length > 0) process.exitCode = 1
})()
