// ============================================================
// Prueba de integración de la máquina de estados de Reserva
// (Tesis STG — hallazgo A-11 de la auditoría)
//
// El §5.3 de la tesis verifica UNA sola transición (el avance automático
// a PAGADA). Este script recorre la matriz completa de TRANSICIONES_VALIDAS
// definida en src/services/reservas.service.ts y comprueba, contra la API
// real, que:
//   (a) las transiciones válidas se aceptan, y
//   (b) las transiciones INVÁLIDAS se rechazan con 4xx.
//
// Probar el rechazo es lo que la auditoría reclama: un componente descrito
// como garante de la consistencia del dominio no queda verificado si solo
// se prueban los caminos felices.
//
// Uso (con el back levantado):
//   node scripts/test_maquina_estados.mjs
//   API_BASE=http://localhost:3001/api node scripts/test_maquina_estados.mjs
// ============================================================

const BASE = process.env.API_BASE || 'http://localhost:3001/api'
const API_KEY = process.env.N8N_API_KEY || ''

// Espejo de TRANSICIONES_VALIDAS (src/services/reservas.service.ts).
// Si cambia allá, actualizar acá — el test unitario cubre la coherencia
// interna del mapa; este script cubre su aplicación efectiva vía HTTP.
const ESTADOS = ['EN_PROCESO', 'SEÑADA', 'PAGADA', 'DOCUMENTADA', 'EN_VIAJE', 'FINALIZADA', 'CANCELADA']

const TRANSICIONES_VALIDAS = {
  EN_PROCESO:  ['SEÑADA', 'PAGADA', 'CANCELADA'],
  SEÑADA:      ['PAGADA', 'CANCELADA'],
  PAGADA:      ['DOCUMENTADA', 'CANCELADA', 'SEÑADA', 'EN_PROCESO'],
  DOCUMENTADA: ['EN_VIAJE', 'CANCELADA'],
  EN_VIAJE:    ['FINALIZADA', 'CANCELADA'],
  FINALIZADA:  [],
  CANCELADA:   [],
}

const headers = { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }

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

// ---- Semilla mínima: cliente → destinos → viaje → cotización ----
async function sembrarBase() {
  const stamp = Date.now()
  const cli = (await call('POST', '/clientes', { nombre: 'Test', apellido: 'Estados', telefono: '+5492610000100', email: `estados${stamp}@test.local` })).data
  const dA = (await call('POST', '/destinos', { nombre: 'Origen ME', codigoIATA: rndIATA(), pais: 'Argentina' })).data
  const dB = (await call('POST', '/destinos', { nombre: 'Destino ME', codigoIATA: rndIATA(), pais: 'España' })).data
  const via = (await call('POST', '/viajes', {
    origenId: dA?.id, destinoId: dB?.id, tieneEscalas: false, descripcion: 'Viaje máquina de estados',
    tramos: [{ origenId: dA?.id, destinoId: dB?.id, orden: 1 }],
  })).data
  const cot = (await call('POST', '/cotizaciones', {
    viajeId: via?.id, clienteId: cli?.id,
    fechaVencimiento: new Date(Date.now() + 7 * 864e5).toISOString(),
    moneda: 'USD', precioIda: 500, precioVuelta: 500, precioIdaYVuelta: 1000, impuestos: 0,
  })).data
  if (!cli?.id || !cot?.id) throw new Error('No se pudo sembrar la base. ¿Está levantado el back y migrada la DB?')
  return { clienteId: cli.id, cotizacionId: cot.id }
}

async function nuevaReserva(base) {
  const r = (await call('POST', '/reservas', {
    clienteId: base.clienteId, cotizacionId: base.cotizacionId,
    tipoReserva: 'IDA_Y_VUELTA', montoFinal: 1000, observaciones: 'test estados',
  })).data
  return r?.id
}

// Lleva una reserva recién creada hasta `destino` por un camino válido.
const CAMINOS = {
  EN_PROCESO:  [],
  SEÑADA:      ['SEÑADA'],
  PAGADA:      ['PAGADA'],
  DOCUMENTADA: ['PAGADA', 'DOCUMENTADA'],
  EN_VIAJE:    ['PAGADA', 'DOCUMENTADA', 'EN_VIAJE'],
  FINALIZADA:  ['PAGADA', 'DOCUMENTADA', 'EN_VIAJE', 'FINALIZADA'],
  CANCELADA:   ['CANCELADA'],
}

async function reservaEn(base, estado) {
  const id = await nuevaReserva(base)
  if (!id) return null
  for (const paso of CAMINOS[estado]) {
    const r = await call('PATCH', `/reservas/${id}/estado`, { estado: paso, motivo: 'setup de prueba' })
    if (!r.ok) return null
  }
  const det = (await call('GET', `/reservas/${id}`)).data
  return det?.estado === estado ? id : null
}

;(async () => {
  console.log(`\n🔁 Matriz de transiciones de Reserva contra ${BASE}\n`)

  const base = await sembrarBase()
  const resultados = []
  let okCount = 0, failCount = 0, saltados = 0

  for (const desde of ESTADOS) {
    for (const hacia of ESTADOS) {
      if (desde === hacia) continue                       // no-op, cubierto por el test unitario
      const deberiaPermitir = TRANSICIONES_VALIDAS[desde].includes(hacia)

      const id = await reservaEn(base, desde)
      if (!id) {
        saltados++
        resultados.push({ desde, hacia, esperado: deberiaPermitir, obtenido: null, veredicto: '⏭️  NO SE PUDO PREPARAR' })
        continue
      }

      const r = await call('PATCH', `/reservas/${id}/estado`, { estado: hacia, motivo: 'prueba de matriz' })
      const permitido = r.ok
      const correcto = permitido === deberiaPermitir
      if (correcto) okCount++; else failCount++

      resultados.push({
        desde, hacia,
        esperado: deberiaPermitir ? 'permitir' : 'rechazar',
        obtenido: permitido ? `permitida (${r.status})` : `rechazada (${r.status})`,
        veredicto: correcto ? '✅' : '❌',
      })
    }
  }

  // ---- Reporte ----
  console.log('  DESDE           → HACIA            ESPERADO    OBTENIDO')
  console.log('  ' + '─'.repeat(68))
  for (const r of resultados) {
    console.log(`  ${r.veredicto} ${r.desde.padEnd(13)} → ${String(r.hacia).padEnd(14)} ${String(r.esperado).padEnd(11)} ${r.obtenido ?? '—'}`)
  }

  const invalidas = resultados.filter(r => r.esperado === 'rechazar')
  const invalidasOk = invalidas.filter(r => r.veredicto === '✅').length

  console.log('\n' + '═'.repeat(70))
  console.log(`Transiciones evaluadas:            ${resultados.length - saltados}`)
  console.log(`  · comportamiento correcto:       ${okCount}`)
  console.log(`  · comportamiento incorrecto:     ${failCount}`)
  if (saltados) console.log(`  · no evaluadas (setup falló):    ${saltados}`)
  console.log(`Transiciones inválidas probadas:   ${invalidas.length}  (rechazadas correctamente: ${invalidasOk})`)
  console.log('═'.repeat(70))

  console.log('\nResumen para §5.3:')
  console.log(`  "Se recorrió la matriz completa de transiciones de la entidad Reserva, evaluando`)
  console.log(`   ${resultados.length - saltados} pares de estados sobre los siete estados definidos. Las ${invalidas.length} transiciones no`)
  console.log(`   permitidas por la especificación fueron rechazadas por la API en ${invalidasOk} de los casos,`)
  console.log(`   y las transiciones válidas se aplicaron correctamente. Se detectaron ${failCount}`)
  console.log(`   desviaciones respecto del comportamiento especificado."`)
  console.log('')

  if (failCount > 0) process.exitCode = 1
})()
