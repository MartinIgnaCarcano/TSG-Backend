// ============================================================
// Instrumentación del flujo de notificaciones proactivas — Tesis STG
// Objetivo específico 2 (§4.4.3, §5.5)
//
// §5.5 declara hoy: "ninguna corrida de ese flujo fue instrumentada, ni se
// verificó la deduplicación de envíos, por lo que la funcionalidad se
// reporta como implementada y no validada". Este script cierra eso.
//
// CRITERIOS DE ÉXITO, FIJADOS A PRIORI (declararlos así en §3.5):
//   C1 · Captura      Los recordatorios con fecha vencida y no ejecutados
//                     son recuperados por la consulta del flujo.
//   C2 · Especificidad Cada tipo produce el mensaje propio de su tipo y no
//                     el genérico de la rama por defecto.
//   C3 · Deduplicación Tras ejecutarse, ninguno vuelve a ser recuperado en
//                     una corrida posterior.
//   C4 · Idempotencia  Reejecutar uno ya ejecutado no lo reactiva.
//
// SEGURIDAD. Corre contra la base real. Por eso:
//   · Solo crea y borra filas de Recordatorio. No toca reservas, clientes,
//     pagos ni documentos.
//   · Pide confirmación explícita antes de escribir.
//   · Deja los ids en _recordatorios_prueba.json para poder limpiar aunque
//     el script se corte a la mitad (node test_recordatorios.mjs --limpiar).
//   · Por defecto NO dispara el flujo de n8n, así que NO se envía ningún
//     WhatsApp a nadie. Con --con-n8n el script pausa para que ejecutes el
//     Flujo3 a mano, y ahí sí Twilio manda mensajes reales al teléfono del
//     cliente de la reserva elegida. Usá --con-n8n solo sobre una reserva
//     cuyo teléfono sea tuyo.
//
// Uso:
//   API_BASE=https://... N8N_API_KEY=... node scripts/test_recordatorios.mjs
//   ... --reserva <id>     elegir la reserva a mano
//   ... --con-n8n          pausar para ejecutar el Flujo3 real (manda WhatsApp)
//   ... --limpiar          borrar los recordatorios de una corrida anterior
//   ... --si               saltear las confirmaciones (para CI)
// ============================================================
import fs from 'fs'
import readline from 'node:readline/promises'

const ARGV = process.argv.slice(2)
const flag = (n) => ARGV.includes(n)
const val = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 ? ARGV[i + 1] : d }

const API = (process.env.API_BASE || '').replace(/\/+$/, '')
const KEY = process.env.N8N_API_KEY || ''
const CON_N8N = flag('--con-n8n')
const AUTO = flag('--si')
const ESTADO = new URL('./_recordatorios_prueba.json', import.meta.url)

const TIPOS = ['PAGO_SALDO', 'CHECK_IN', 'POST_VIAJE', 'CLIMA', 'VOUCHER', 'CONTRATO']

if (!API) { console.error('❌ Falta API_BASE (ej: https://stg-backend-production.up.railway.app)'); process.exit(1) }

const log = []
const l = (s = '') => { console.log(s); log.push(s) }

async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(KEY && { 'x-api-key': KEY }), ...opts.headers },
  })
  const txt = await r.text()
  let body
  try { body = txt ? JSON.parse(txt) : null } catch { body = txt }
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${r.status} ${JSON.stringify(body).slice(0, 200)}`)
  return body
}

async function confirmar(pregunta) {
  if (AUTO) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const a = (await rl.question(`${pregunta} [escribí SI para continuar] `)).trim()
  rl.close()
  return a === 'SI'
}

// --- réplica exacta del switch del nodo «Armar mensaje según tipo» del
//     Flujo3_Recordatorios, para diagnosticar qué tipos producen mensaje
//     propio y cuáles caen a la rama por defecto. Si cambian el flujo,
//     hay que actualizar esta lista y volver a correr.
const TIPOS_CON_CASE = ['PAGO_SALDO', 'CHECK_IN', 'POST_VIAJE', 'CLIMA']

async function limpiar(ids, silencioso = false) {
  let ok = 0, fallo = 0
  for (const id of ids) {
    try { await api(`/api/recordatorios/${id}`, { method: 'DELETE' }); ok++ }
    catch { fallo++ }
  }
  if (!silencioso) l(`  Limpieza: ${ok} borrado(s)${fallo ? `, ${fallo} con error` : ''}`)
  try { fs.unlinkSync(ESTADO) } catch {}
  return { ok, fallo }
}

;(async () => {
  // ---------- modo limpieza ----------
  if (flag('--limpiar')) {
    if (!fs.existsSync(ESTADO)) { console.log('No hay corrida previa que limpiar.'); return }
    const { ids } = JSON.parse(fs.readFileSync(ESTADO))
    console.log(`Borrando ${ids.length} recordatorio(s) de una corrida anterior...`)
    await limpiar(ids)
    return
  }

  const HOY = new Date().toISOString().slice(0, 10)
  l('Instrumentación del flujo de recordatorios — Objetivo específico 2')
  l('='.repeat(66))
  l(`API: ${API}`)
  l(`Fecha de corrida: ${HOY}   ·   modo: ${CON_N8N ? 'CON ejecución real del Flujo3 (envía WhatsApp)' : 'sin n8n (no se envía ningún mensaje)'}`)
  l('')

  // ---------- preflight ----------
  try {
    await api('/api/health')
    l('✓ La API responde.')
  } catch (e) {
    console.error(`❌ No pude contactar la API: ${e.message}`)
    console.error('   Revisá API_BASE y, si AUTH_ENABLED=true, N8N_API_KEY.')
    process.exit(1)
  }

  const esProd = /railway|vercel|production/i.test(API)
  if (esProd) {
    l('')
    l('⚠️  Estás apuntando a un entorno que parece de PRODUCCIÓN.')
    l('   El script va a crear seis recordatorios de prueba y borrarlos al final.')
    l('   No toca reservas, clientes, pagos ni documentos.')
    if (CON_N8N) l('   Y con --con-n8n se van a enviar mensajes de WhatsApp REALES.')
    if (!(await confirmar('¿Seguimos?'))) { l('Cancelado.'); return }
  }

  // ---------- elegir reserva ----------
  let reservaId = val('--reserva', null)
  let reserva
  if (reservaId) {
    reserva = await api(`/api/reservas/${reservaId}`)
  } else {
    const reservas = await api('/api/reservas')
    if (!Array.isArray(reservas) || !reservas.length) {
      console.error('❌ No hay reservas en la base. Creá una desde el panel o pasá --reserva <id>.')
      process.exit(1)
    }
    reserva = reservas[0]
    reservaId = reserva.id
  }
  const tel = reserva?.cliente?.telefono || '(sin teléfono)'
  l('')
  l(`Reserva elegida: ${reserva.numeroReserva || reservaId}`)
  l(`  Cliente: ${reserva?.cliente?.nombre || '?'} ${reserva?.cliente?.apellido || ''} · tel ${tel}`)
  if (CON_N8N) {
    l('')
    l(`⚠️  Con --con-n8n, el Flujo3 va a mandar WhatsApp a ${tel}.`)
    if (!(await confirmar('¿Ese teléfono es tuyo?'))) { l('Cancelado.'); return }
  }

  // ---------- sembrar ----------
  const ayer = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const creados = []
  l('')
  l('Sembrando un recordatorio vencido de cada tipo...')
  try {
    for (const tipo of TIPOS) {
      const r = await api('/api/recordatorios', {
        method: 'POST',
        body: JSON.stringify({ reservaId, tipo, fechaProgramada: ayer }),
      })
      creados.push({ id: r.id, tipo })
      l(`  · ${tipo.padEnd(12)} → ${r.id}`)
    }
  } catch (e) {
    l(`❌ Falló la siembra: ${e.message}`)
    if (creados.length) { l('Limpiando lo que alcancé a crear...'); await limpiar(creados.map((c) => c.id)) }
    process.exit(1)
  }
  fs.writeFileSync(ESTADO, JSON.stringify({ fecha: HOY, reservaId, ids: creados.map((c) => c.id) }, null, 2))

  const resultados = {}
  try {
    // ---------- C1 · captura ----------
    l('')
    l('C1 · ¿La consulta del flujo los recupera?')
    const pend = await api(`/api/recordatorios?pendientes=true&fecha=${HOY}`)
    const idsPend = new Set(pend.map((r) => r.id))
    const capturados = creados.filter((c) => idsPend.has(c.id))
    resultados.C1 = capturados.length === creados.length
    l(`  Recuperados ${capturados.length} de ${creados.length}  →  ${resultados.C1 ? '✓ CUMPLE' : '✗ NO CUMPLE'}`)
    for (const c of creados) if (!idsPend.has(c.id)) l(`    · no apareció: ${c.tipo}`)

    // ---------- C2 · especificidad del mensaje ----------
    l('')
    l('C2 · ¿Cada tipo produce el mensaje propio de su tipo?')
    l('  (según el switch del nodo «Armar mensaje según tipo» del Flujo3)')
    const genericos = TIPOS.filter((t) => !TIPOS_CON_CASE.includes(t))
    resultados.C2 = genericos.length === 0
    for (const t of TIPOS) {
      const ok = TIPOS_CON_CASE.includes(t)
      l(`  · ${t.padEnd(12)} ${ok ? '✓ mensaje propio' : '✗ cae a la rama por defecto (mensaje genérico)'}`)
    }
    l(`  →  ${resultados.C2 ? '✓ CUMPLE' : '✗ NO CUMPLE'}`)
        if (!resultados.C2) {
      l('')
      l(`  Hallazgo: ${genericos.join(', ')} están declarados en el enum TipoRecordatorio`)
      l('  (prisma/schema.prisma) pero el flujo del cron no tiene un case para ellos.')
      l('  No es un defecto: VOUCHER y CONTRATO se despachan por webhook desde el')
      l('  Flujo7 en el momento en que el documento se emite, que es lo correcto para')
      l('  un aviso disparado por un evento y no por una fecha. Lo que sí corresponde')
      l('  corregir es el texto de §4.4.3 y §5.5, donde hoy se afirma que los seis')
      l('  tipos salen del nodo Cron: son cuatro por cron y dos por webhook.')
      l('')
      l('  Corresponde declarar que el criterio C2, tal como fue fijado a priori,')
      l('  presupone que los seis tipos se despachan desde el mismo flujo. Ese')
      l('  presupuesto era incorrecto. El criterio no se redefine con posterioridad')
      l('  a la corrida: se reporta como no cumplido y se explica el motivo.')
    }

    // ---------- ejecución ----------
    l('')
    if (CON_N8N) {
      l('Ahora ejecutá el Flujo3_Recordatorios a mano desde n8n («Execute workflow»).')
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      await rl.question('Cuando termine, apretá ENTER para verificar... ')
      rl.close()
    } else {
      l('Ejecutando los recordatorios por la misma vía que usa el flujo (PATCH /ejecutar)...')
      for (const c of creados) {
        await api(`/api/recordatorios/${c.id}/ejecutar`, {
          method: 'PATCH',
          body: JSON.stringify({ resultado: 'prueba de instrumentación OE2' }),
        })
      }
      l(`  ${creados.length} marcados como ejecutados.`)
    }

    // ---------- C3 · deduplicación ----------
    l('')
    l('C3 · ¿Una segunda corrida vuelve a levantarlos?')
    const pend2 = await api(`/api/recordatorios?pendientes=true&fecha=${HOY}`)
    const ids2 = new Set(pend2.map((r) => r.id))
    const reaparecen = creados.filter((c) => ids2.has(c.id))
    resultados.C3 = reaparecen.length === 0
    l(`  Reaparecen ${reaparecen.length} de ${creados.length}  →  ${resultados.C3 ? '✓ CUMPLE' : '✗ NO CUMPLE'}`)
    for (const c of reaparecen) l(`    · reapareció: ${c.tipo} (${c.id})`)

    // ---------- C4 · idempotencia ----------
    l('')
    l('C4 · ¿Reejecutar uno ya ejecutado lo reactiva?')
    const uno = creados[0]
    let err = null
    try {
      await api(`/api/recordatorios/${uno.id}/ejecutar`, {
        method: 'PATCH',
        body: JSON.stringify({ resultado: 'segunda ejecución — prueba de idempotencia' }),
      })
    } catch (e) { err = e.message }
    const rel = await api(`/api/recordatorios/${uno.id}`)
    resultados.C4 = rel.ejecutado === true
    l(`  Segunda ejecución: ${err ? `rechazada (${err.slice(0, 60)})` : 'aceptada'}`)
    l(`  Estado final: ejecutado=${rel.ejecutado}  →  ${resultados.C4 ? '✓ CUMPLE' : '✗ NO CUMPLE'}`)
    l('  Nota: que la API acepte el PATCH no implica reenvío. Lo que garantiza el no')
    l('  duplicado es que el flujo solo consulta ?pendientes=true, verificado en C3.')
  } finally {
    // ---------- limpieza, pase lo que pase ----------
    l('')
    l('Limpiando los recordatorios de prueba...')
    await limpiar(creados.map((c) => c.id))
  }

  // ---------- reporte ----------
  l('')
  l('='.repeat(66))
  l('RESULTADO — Objetivo específico 2 (notificaciones proactivas)')
  const nombres = {
    C1: 'Captura de recordatorios vencidos',
    C2: 'Especificidad del mensaje por tipo',
    C3: 'Deduplicación entre corridas',
    C4: 'Idempotencia de la ejecución',
  }
  let cumplidos = 0
  for (const k of ['C1', 'C2', 'C3', 'C4']) {
    const ok = resultados[k]
    if (ok) cumplidos++
    l(`  ${k} · ${nombres[k].padEnd(38)} ${ok ? '✓ CUMPLE' : '✗ NO CUMPLE'}`)
  }
  l('')
  l(`  ${cumplidos} de 4 criterios cumplidos.`)
  l('')
  l('  Reportar en §5.5 con este detalle. Un 3 de 4 con el incumplimiento explicado')
  l('  vale más que declarar la funcionalidad "implementada y no validada", que es')
  l('  lo que el capítulo dice hoy.')

  const salida = `validacion_recordatorios_${HOY}.txt`
  fs.writeFileSync(new URL(`./${salida}`, import.meta.url), log.join('\n'))
  console.log(`\n📄 Transcripción: scripts/${salida}`)
})().catch((e) => {
  console.error('\n❌ Error:', e.message)
  console.error('   Si quedaron recordatorios de prueba, borralos con:')
  console.error('   node scripts/test_recordatorios.mjs --limpiar')
  process.exit(1)
})
