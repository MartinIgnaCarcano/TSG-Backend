// ============================================================
// Medición de latencia EXTREMO A EXTREMO del flujo de cotización
// (Tesis STG — hallazgo C-1 de la auditoría)
//
// PROBLEMA QUE RESUELVE
// scripts/medir_latencia.mjs cronometra el endpoint de búsqueda y le SUMA una
// constante de inferencia medida en otro experimento. Esa suma sintética no
// incluye el webhook, la ejecución de los nodos de n8n, la recuperación de la
// memoria de conversación, el formateo del mensaje ni la ida y vuelta contra
// Twilio — y sobre todo, no incluye los turnos conversacionales que un usuario
// real necesita para suministrar origen, destino y fechas.
// La línea de base humana (15–40 min), en cambio, cubre el proceso completo.
//
// Este script mide el proceso completo, en dos condiciones, y deja un CSV con
// el detalle por corrida.
//
//   Condición A — datos completos en un solo mensaje
//   Condición B — recolección progresiva (el usuario responde de a un dato)
//
// La condición B es la comparable contra la línea de base manual.
//
// MODOS
//   MODO=pipeline (default)
//       Reproduce el flujo con los mismos componentes de producción: llama a
//       Groq con el system prompt EXACTO leído del workflow (igual que
//       validar_agente.mjs) y, cuando el JSON queda completo, dispara las tres
//       variantes de fecha contra /api/calculadora/buscar en paralelo, como
//       hace el flujo. Mide inferencia + búsqueda + turnos.
//       No incluye: overhead de nodos de n8n ni tránsito por Twilio.
//
//   MODO=n8n
//       Dispara el webhook real de n8n y cronometra hasta su respuesta.
//       Requiere N8N_WEBHOOK_URL (la URL de ngrok). Incluye el orquestador.
//
// Para la latencia PERCIBIDA por el usuario (incluido Twilio) el instrumento
// correcto es la consola de Twilio: Monitor → Messaging → Logs da dateSent de
// cada mensaje. El CSV registra ts_inicio/ts_fin para poder cruzarlos.
//
// USO
//   GROQ_API_KEY=gsk_xxx node scripts/medir_latencia_e2e.mjs
//   RUNS=5 MODO=n8n N8N_WEBHOOK_URL=https://xxx.ngrok.io/webhook/bot node scripts/medir_latencia_e2e.mjs
//
// Requiere el back levantado, RAPIDAPI_KEY configurada y MOCK_FLIGHTS=false
// (si la búsqueda devuelve 0 opciones por cuota agotada, el tiempo NO es
// representativo y el script lo avisa).
//
// SALIDA: evidencia/latencia_e2e_<fecha>.csv + resumen por consola
// ============================================================

import fs from 'fs'
import path from 'path'

const BASE = process.env.API_BASE || 'http://localhost:3001/api'
const MODO = (process.env.MODO || 'pipeline').toLowerCase()
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || ''
const RUNS = Number(process.env.RUNS ?? 5)             // corridas POR condición
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 6000)  // plan gratuito de Groq: 12k TPM
const API_KEY = process.env.N8N_API_KEY || ''
const KEY = process.env.GROQ_API_KEY
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const TEMP = Number(process.env.GROQ_TEMP ?? 0.2)
const HOY = new Date().toISOString().slice(0, 10)

const headers = { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ahora = () => Date.now()

// --- system prompt EXACTO de producción, leído del workflow ---
let SYS = ''
if (MODO === 'pipeline') {
  const wf = JSON.parse(fs.readFileSync(new URL('../workflows/Bot_STG_Twilio_n8n.json', import.meta.url)))
  const agente = wf.nodes.find(n => n.name === 'AI Agent Vendedor')
  SYS = agente.parameters.options.systemMessage
    .replace(/^=/, '')
    .replace(/\{\{\s*DateTime\.now\(\)\.toFormat\('yyyy-MM-dd'\)\s*\}\}/g, HOY)
}

const RUTAS = [
  { origen: 'Mendoza',      destino: 'Madrid', oi: 'MDZ', di: 'MAD', ida: '2026-10-10', vuelta: '2026-10-20' },
  { origen: 'Córdoba',      destino: 'Miami',  oi: 'COR', di: 'MIA', ida: '2026-11-05', vuelta: '2026-11-15' },
  { origen: 'Buenos Aires', destino: 'Cancún', oi: 'EZE', di: 'CUN', ida: '2026-12-02', vuelta: '2026-12-12' },
]

function guion(condicion, r) {
  if (condicion === 'A') {
    return [
      `Quiero viajar de ${r.origen} a ${r.destino} del ${r.ida} al ${r.vuelta}`,
      'Sí, es correcto. Buscá los vuelos por favor.',
    ]
  }
  return [
    `Hola, quiero viajar a ${r.destino}`,
    `Desde ${r.origen}`,
    `Del ${r.ida} al ${r.vuelta}`,
    'Sí, es correcto. Buscá los vuelos por favor.',
  ]
}

const parseBooking = (text) => {
  const m = String(text).match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0])
    if (j.origenIATA && j.destinoIATA && j.fechaIda && j.fechaVuelta) return j
  } catch {}
  return null
}

async function groq(messages) {
  for (let intento = 0; intento < 6; intento++) {
    const t0 = ahora()
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: TEMP, messages }),
    })
    const ms = ahora() - t0
    const j = await r.json()
    const msg = j?.error?.message || ''
    if (r.status === 429 || /rate limit/i.test(msg)) {
      const m = msg.match(/try again in ([\d.]+)\s*s/i)
      const espera = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1000 : 25000
      console.log(`      ⏳ límite de Groq, espero ${Math.round(espera / 1000)}s...`)
      await sleep(espera)
      continue
    }
    return { out: j.choices?.[0]?.message?.content ?? '', ms, error: !j.choices }
  }
  return { out: '', ms: 0, error: true }
}

// Tres variantes de fecha, en paralelo, como hace el nodo del flujo
function variantes(fechaIda, fechaVuelta, offset = 3) {
  const sumar = (f, d) => { const x = new Date(f + 'T12:00:00Z'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10) }
  return [-offset, 0, offset].map(off => ({ off, ida: sumar(fechaIda, off), vuelta: sumar(fechaVuelta, off) }))
}

async function buscarVuelos(j) {
  const vs = variantes(j.fechaIda, j.fechaVuelta)
  const t0 = ahora()
  const res = await Promise.all(vs.map(v =>
    fetch(BASE + '/calculadora/buscar', {
      method: 'POST', headers,
      body: JSON.stringify({ origenIATA: j.origenIATA, destinoIATA: j.destinoIATA, fechaIda: v.ida, fechaVuelta: v.vuelta }),
    }).then(r => r.json()).catch(e => ({ error: e.message }))
  ))
  const opciones = res.reduce((a, x) => a + ((x?.opciones || []).length), 0)
  return { ms: ahora() - t0, opciones, variantes: vs.length }
}

// ---------- Corrida en modo pipeline ----------
async function corridaPipeline(condicion, r) {
  const mensajes = guion(condicion, r)
  const hist = [{ role: 'system', content: SYS }]
  const tInicio = ahora()
  const turnosMs = []
  let msLlm = 0, msBusqueda = 0, opciones = 0, fallo = null, json = null

  for (const m of mensajes) {
    hist.push({ role: 'user', content: m })
    const { out, ms, error } = await groq(hist)
    if (error) { fallo = 'error de Groq'; break }
    hist.push({ role: 'assistant', content: out })
    turnosMs.push(ms); msLlm += ms
    const j = parseBooking(out)
    if (j) { json = j; break }
  }

  if (json) {
    const b = await buscarVuelos(json)
    msBusqueda = b.ms; opciones = b.opciones
    if (opciones === 0) fallo = 'búsqueda sin opciones (¿cuota agotada / MOCK_FLIGHTS?)'
  } else if (!fallo) {
    fallo = 'el agente no completó el JSON'
  }

  return {
    condicion, ruta: `${r.oi}→${r.di}`, turnos: turnosMs.length,
    msTotal: ahora() - tInicio, msLlm, msBusqueda, opciones, turnosMs, fallo,
    tsInicio: new Date(tInicio).toISOString(), tsFin: new Date().toISOString(),
  }
}

// ---------- Corrida en modo n8n ----------
async function corridaN8N(condicion, r, idx) {
  const from = `+549261${String(Date.now()).slice(-7)}${idx}`
  const mensajes = guion(condicion, r)
  const tInicio = ahora()
  const turnosMs = []
  let fallo = null

  for (const m of mensajes) {
    const t0 = ahora()
    try {
      const params = new URLSearchParams({ From: `whatsapp:${from}`, Body: m, To: 'whatsapp:+14155238886' })
      const resp = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      await resp.text()
      if (!resp.ok) fallo = `HTTP ${resp.status}`
    } catch (e) { fallo = e.message; break }
    turnosMs.push(ahora() - t0)
    await sleep(400)
  }

  return {
    condicion, ruta: `${r.oi}→${r.di}`, turnos: turnosMs.length,
    msTotal: ahora() - tInicio, msLlm: 0, msBusqueda: 0, opciones: -1, turnosMs, fallo,
    tsInicio: new Date(tInicio).toISOString(), tsFin: new Date().toISOString(),
  }
}

const mediana = a => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const fmt = ms => (ms / 1000).toFixed(1) + ' s'

;(async () => {
  if (MODO === 'n8n' && !N8N_WEBHOOK_URL) {
    console.error('❌ MODO=n8n requiere N8N_WEBHOOK_URL (la URL de ngrok del webhook del bot).'); process.exit(1)
  }
  if (MODO === 'pipeline' && !KEY) {
    console.error('❌ MODO=pipeline requiere GROQ_API_KEY (la misma que usás en n8n).'); process.exit(1)
  }

  console.log(`\n⏱️  Latencia extremo a extremo — modo ${MODO.toUpperCase()}`)
  console.log(`   ${RUNS} corridas por condición · ${MODO === 'n8n' ? N8N_WEBHOOK_URL : BASE}\n`)

  const filas = []
  for (const condicion of ['A', 'B']) {
    console.log(`── Condición ${condicion} — ${condicion === 'A' ? 'datos completos en un mensaje' : 'recolección progresiva'} ──`)
    for (let i = 0; i < RUNS; i++) {
      const r = RUTAS[i % RUTAS.length]
      const res = MODO === 'n8n' ? await corridaN8N(condicion, r, i) : await corridaPipeline(condicion, r)
      filas.push(res)
      const det = MODO === 'pipeline' ? `  (LLM ${fmt(res.msLlm)} · búsqueda ${fmt(res.msBusqueda)} · ${res.opciones} opciones)` : ''
      console.log(`   ${i + 1}. ${res.ruta}  ${res.turnos} turnos  →  ${fmt(res.msTotal)}${det}${res.fallo ? `  ⚠️  ${res.fallo}` : ''}`)
      await sleep(PAUSA_MS)
    }
    console.log('')
  }

  // ---- CSV ----
  const dir = path.resolve('evidencia')
  fs.mkdirSync(dir, { recursive: true })
  const archivo = path.join(dir, `latencia_e2e_${new Date().toISOString().slice(0, 10)}.csv`)
  const cab = 'condicion,ruta,turnos,ms_total,ms_llm,ms_busqueda,opciones,ms_por_turno,ts_inicio,ts_fin,modo,fallo\n'
  const cuerpo = filas.map(f => [
    f.condicion, f.ruta, f.turnos, f.msTotal, f.msLlm, f.msBusqueda, f.opciones,
    `"${f.turnosMs.join('|')}"`, f.tsInicio, f.tsFin, MODO, f.fallo ?? '',
  ].join(',')).join('\n')
  fs.writeFileSync(archivo, cab + cuerpo + '\n')

  // ---- Resumen ----
  console.log('═'.repeat(74))
  for (const condicion of ['A', 'B']) {
    const v = filas.filter(f => f.condicion === condicion && !f.fallo).map(f => f.msTotal)
    if (!v.length) { console.log(`Condición ${condicion}: sin corridas válidas ⚠️`); continue }
    console.log(`Condición ${condicion}:  n=${v.length}  mediana ${fmt(mediana(v))}  rango ${fmt(Math.min(...v))}–${fmt(Math.max(...v))}`)
    console.log(`   observaciones: ${v.map(x => (x / 1000).toFixed(1)).join(', ')} s`)
  }
  console.log('═'.repeat(74))

  const vB = filas.filter(f => f.condicion === 'B' && !f.fallo).map(f => f.msTotal)
  if (vB.length) {
    const medB = mediana(vB)
    console.log('\nFactor de reducción contra la línea de base manual (condición B):')
    console.log(`   vs 15 min (cota inferior conservadora):  ${(900000 / medB).toFixed(1)}×`)
    console.log(`   vs 40 min (cota superior):               ${(2400000 / medB).toFixed(1)}×`)
  }

  console.log('\n⚠️  Notas para el reporte:')
  console.log('   · La condición B es la comparable contra los 15–40 min: incluye los turnos')
  console.log('     conversacionales que el proceso manual también incluye. La condición A')
  console.log('     subestima el tiempo real.')
  console.log('   · El tiempo NO incluye la espera de respuesta del usuario, que es del usuario')
  console.log('     y no del sistema. Declarar ambas magnitudes por separado.')
  if (MODO === 'pipeline') {
    console.log('   · Modo pipeline: excluye el overhead de nodos de n8n y el tránsito por Twilio.')
    console.log('     Para la latencia percibida, cruzar ts_inicio/ts_fin con la consola de Twilio.')
  }
  console.log(`\n📄 Registro por corrida: ${archivo}\n`)
})()
