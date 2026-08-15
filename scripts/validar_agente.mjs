// ============================================================
// Validación del agente conversacional (Tesis STG — §5.1 / §5.2)
// Corre los 23 diálogos de los 6 escenarios (Tabla 5) contra el
// MISMO modelo de producción (Groq / llama-3.3-70b-versatile) usando
// el system prompt EXACTO leído del workflow del bot. Puntúa cada
// diálogo con el criterio binario de la Tabla 5b, mide la latencia de
// inferencia y guarda la transcripción completa (auditable).
//
// Uso (con la key de Groq que usás en n8n):
//   GROQ_API_KEY=gsk_xxx node scripts/validar_agente.mjs
//
// Mide la EXTRACCIÓN DE ENTIDADES (lo que reporta el 87%). La búsqueda
// de vuelos / comparativa es posterior y vive en n8n; la latencia de
// extremo a extremo de §5.2 se mide aparte (cronómetro sobre WhatsApp
// o el endpoint /api/calculadora/buscar para el componente de búsqueda).
// ============================================================
import fs from 'fs'

const KEY = process.env.GROQ_API_KEY
if (!KEY) {
  console.error('❌ Falta GROQ_API_KEY.\n   Corré:  GROQ_API_KEY=tu_key node scripts/validar_agente.mjs')
  process.exit(1)
}
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const TEMP = Number(process.env.GROQ_TEMP ?? 0.2)
const HOY = new Date().toISOString().slice(0, 10)

// --- system prompt EXACTO de producción (leído del workflow) ---
const wf = JSON.parse(fs.readFileSync(new URL('../workflows/Bot_STG_Twilio_n8n.json', import.meta.url)))
const agente = wf.nodes.find(n => n.name === 'AI Agent Vendedor')
let SYS = agente.parameters.options.systemMessage
SYS = SYS.replace(/^=/, '').replace(/\{\{\s*DateTime\.now\(\)\.toFormat\('yyyy-MM-dd'\)\s*\}\}/g, HOY)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DELAY = Number(process.env.DELAY_MS ?? 6000) // pausa base entre llamadas (plan gratis Groq: 12k TPM)

async function ask(messages) {
  for (let intento = 0; intento < 6; intento++) {
    const t0 = Date.now()
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature: TEMP, messages }),
    })
    const ms = Date.now() - t0
    const j = await r.json()
    const msg = j?.error?.message || ''
    if (r.status === 429 || /rate limit/i.test(msg)) {
      const m = msg.match(/try again in ([\d.]+)\s*s/i)
      const espera = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1000 : 25000
      console.log(`   ⏳ límite de Groq alcanzado, espero ${Math.round(espera / 1000)}s y reintento...`)
      await sleep(espera)
      continue
    }
    const out = j.choices?.[0]?.message?.content
    if (out == null) return { out: 'ERROR: ' + JSON.stringify(j).slice(0, 200), ms, error: true }
    return { out, ms, error: false }
  }
  return { out: 'ERROR: rate limit persistente tras varios reintentos', ms: 0, error: true }
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
const fechaOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
const jsonCorrecto = (j, oi, di) => !!j && j.origenIATA === oi && j.destinoIATA === di && fechaOk(j.fechaIda) && fechaOk(j.fechaVuelta)
const pideAeropuerto = (t) => /ezeiza|aeroparque|\beze\b|\baep\b|aeropuerto|cu[áa]l de los/i.test(String(t))

// --- Casos de prueba: 23 diálogos en 6 escenarios (Tabla 5) ---
const CASOS = [
  // Esc 1 — completa en un turno (origen/destino sin ambigüedad)
  { id: '1.1', esc: 1, turns: ['Quiero viajar de Mendoza a Madrid del 10 de agosto al 20 de agosto'], oi: 'MDZ', di: 'MAD' },
  { id: '1.2', esc: 1, turns: ['Busco vuelos de Córdoba a Miami, ida el 5 de septiembre y vuelta el 15 de septiembre'], oi: 'COR', di: 'MIA' },
  { id: '1.3', esc: 1, turns: ['Necesito ir de Mendoza a Cancún del 20 al 30 de diciembre'], oi: 'MDZ', di: 'CUN' },
  { id: '1.4', esc: 1, turns: ['Vuelo de Córdoba a Barcelona, salgo el 1 de noviembre y vuelvo el 10 de noviembre'], oi: 'COR', di: 'BCN' },
  { id: '1.5', esc: 1, turns: ['Quiero ir de Mendoza a Río de Janeiro del 2 al 12 de octubre'], oi: 'MDZ', di: 'GIG' },
  // Esc 2 — incompleta progresiva (multi-turno)
  { id: '2.1', esc: 2, turns: ['Hola, quiero viajar a Madrid', 'Desde Mendoza', 'Del 10 al 20 de agosto'], oi: 'MDZ', di: 'MAD' },
  { id: '2.2', esc: 2, turns: ['Quiero un vuelo a Miami', 'Salgo de Córdoba', 'Ida 5 de septiembre, vuelta 15 de septiembre'], oi: 'COR', di: 'MIA' },
  { id: '2.3', esc: 2, turns: ['Necesito viajar en octubre', 'De Mendoza a Río de Janeiro', 'Del 2 al 12 de octubre'], oi: 'MDZ', di: 'GIG' },
  { id: '2.4', esc: 2, turns: ['Quiero ir a Barcelona', 'Desde Córdoba, del 1 al 10 de noviembre'], oi: 'COR', di: 'BCN' },
  { id: '2.5', esc: 2, turns: ['Vuelos a Cancún por favor', 'Desde Mendoza', 'Del 20 al 30 de diciembre'], oi: 'MDZ', di: 'CUN' },
  // Esc 3 — errores tipográficos (debe reconocer la entidad correcta)
  { id: '3.1', esc: 3, turns: ['Quiero ir de Mendosa a Madri del 10 al 20 de agosto'], oi: 'MDZ', di: 'MAD' },
  { id: '3.2', esc: 3, turns: ['Vuelo de Cordova a Miamy, del 5 al 15 de septiembre'], oi: 'COR', di: 'MIA' },
  { id: '3.3', esc: 3, turns: ['Nesesito viajar de Mensoza a Barzelona del 1 al 10 de noviembre'], oi: 'MDZ', di: 'BCN' },
  { id: '3.4', esc: 3, turns: ['Busco vuelo de Cordoba a Cancun del 20 al 30 de diciembre'], oi: 'COR', di: 'CUN' },
  // Esc 4 — ciudad ambigua (Buenos Aires = EZE/AEP): debe PREGUNTAR cuál
  { id: '4.1', esc: 4, turns: ['Quiero viajar de Mendoza a Buenos Aires del 10 al 20 de agosto'], ambigua: true },
  { id: '4.2', esc: 4, turns: ['Quiero viajar de Buenos Aires a Madrid del 5 al 15 de septiembre'], ambigua: true },
  { id: '4.3', esc: 4, turns: ['Vuelo de Buenos Aires a Miami del 1 al 10 de noviembre'], ambigua: true },
  { id: '4.4', esc: 4, turns: ['Necesito ir de Córdoba a Buenos Aires del 20 al 30 de diciembre'], ambigua: true },
  // Esc 5 — flujo completo (paso LLM: debe entregar el JSON que dispara la búsqueda)
  { id: '5.1', esc: 5, turns: ['Quiero viajar de Mendoza a Madrid del 10 al 20 de agosto'], oi: 'MDZ', di: 'MAD', latencia: true },
  { id: '5.2', esc: 5, turns: ['Quiero viajar de Córdoba a Miami del 5 al 15 de septiembre'], oi: 'COR', di: 'MIA', latencia: true },
  { id: '5.3', esc: 5, turns: ['Quiero viajar de Mendoza a Cancún del 20 al 30 de diciembre'], oi: 'MDZ', di: 'CUN', latencia: true },
  // Esc 6 — fuera de dominio: debe declinar (NO entregar JSON de reserva)
  { id: '6.1', esc: 6, turns: ['¿Cuál es la capital de Francia?'], fuera: true },
  { id: '6.2', esc: 6, turns: ['Contame un chiste'], fuera: true },
]

function evaluar(c, finalText) {
  const j = parseBooking(finalText)
  if (c.esc === 4) return (!j && pideAeropuerto(finalText)) ? 'EXITO' : 'FALLA' // éxito = pregunta, no commit
  if (c.esc === 6) return 'REVISAR'                                // juicio humano: Tabla 5b = FALLA si responde sustantivamente
  return jsonCorrecto(j, c.oi, c.di) ? 'EXITO' : 'FALLA'           // esc 1,2,3,5
}

const log = []
const linea = (s = '') => { console.log(s); log.push(s) }

;(async () => {
  linea(`Validación del agente — modelo ${MODEL} (temp ${TEMP}) — fecha ${HOY}`)
  linea('='.repeat(60))
  const porEsc = {}
  const latencias = []
  let exitosTotal = 0, errores = 0, evaluados = 0, revisar = 0

  for (const c of CASOS) {
    const messages = [{ role: 'system', content: SYS }]
    let lastMs = 0, finalText = '', huboError = false
    linea(`\n[${c.id}] Escenario ${c.esc}`)
    const enviar = async (txt) => {
      messages.push({ role: 'user', content: txt })
      const { out, ms, error } = await ask(messages)
      messages.push({ role: 'assistant', content: out })
      lastMs = ms; finalText = out; if (error) huboError = true
      linea(`  👤 ${txt}`)
      linea(`  🤖 (${ms} ms) ${out.replace(/\s+/g, ' ').slice(0, 220)}`)
      await sleep(DELAY)
    }
    for (const turn of c.turns) await enviar(turn)
    // Escenarios de extracción (1,2,3,5): la Tabla 5b evalúa el "segundo turno".
    // Si el agente confirmó en lugar de soltar el JSON, lo confirmamos para que pase a modo máquina.
    const esExtraccion = [1, 2, 3, 5].includes(c.esc)
    if (esExtraccion && !huboError && !parseBooking(finalText)) {
      await enviar('Sí, es correcto. Buscá los vuelos por favor.')
    }

    let veredicto
    if (huboError) {
      errores++
      veredicto = '⚠️ NO EVALUADO (error de API)'
    } else {
      const v = evaluar(c, finalText)
      if (v === 'REVISAR') {
        revisar++
        veredicto = '⚠️ REVISAR (juicio humano: ¿respondió sustantivamente la consulta fuera de dominio?)'
      } else {
        const ok = v === 'EXITO'
        evaluados++
        if (ok) exitosTotal++
        porEsc[c.esc] = porEsc[c.esc] || { n: 0, ok: 0 }
        porEsc[c.esc].n++; if (ok) porEsc[c.esc].ok++
        if (c.latencia) latencias.push(lastMs)
        veredicto = ok ? '✅ ÉXITO' : '❌ FALLA'
      }
    }
    linea(`  ➜ Veredicto: ${veredicto}`)
  }

  linea('\n' + '='.repeat(60))
  linea('RESULTADOS POR ESCENARIO (sobre diálogos evaluados)')
  for (const e of Object.keys(porEsc).sort()) {
    const s = porEsc[e]
    linea(`  Escenario ${e}: ${s.ok}/${s.n} (${Math.round((s.ok / s.n) * 100)}%)`)
  }
  linea('\n' + '='.repeat(60))
  if (errores > 0) linea(`⚠️  ${errores} diálogo(s) NO evaluado(s) por error de API — volvé a correrlos (o subí DELAY_MS).`)
  if (revisar > 0) linea(`⚠️  ${revisar} diálogo(s) del Escenario 6 requieren codificación humana (ver respuestas arriba).\n     Tabla 5b: es FALLA si el agente respondió sustantivamente la consulta fuera de dominio antes de reconducir.`)
  const tasa = evaluados ? exitosTotal / evaluados : 0
  // Reporte desagregado por constructo (hallazgo C-2 de la auditoría):
  // los escenarios 1–5 miden EXTRACCIÓN (debe producir JSON válido) y el
  // escenario 6 mide CONTENCIÓN DEL DOMINIO (debe NO producir JSON). Son
  // criterios de éxito de naturaleza opuesta y no se agregan en una tasa única.
  linea('INDICADOR 1 — Precisión de extracción (escenarios 1 a 5)')
  linea(`  ${exitosTotal}/${evaluados} = ${(tasa * 100).toFixed(1)}%   ·   umbral declarado a priori: 80%`)
  linea('INDICADOR 2 — Contención del dominio (escenario 6)')
  linea(`  ${revisar} diálogo(s) pendientes de codificación humana · criterio: la totalidad de los casos`)
  linea('  (En la corrida documentada en la tesis el resultado fue 0/2.)')
  linea('NOTA: no se reporta una tasa agregada sobre los 23 diálogos. Agregar ambos')
  linea('      conjuntos mezclaría dos constructos que la definición operacional')
  linea('      de la Tabla 4 no autoriza a sumar.')
  if (latencias.length) {
    const sorted = [...latencias].sort((a, b) => a - b)
    const mediana = sorted[Math.floor(sorted.length / 2)]
    linea(`Latencia de inferencia LLM (Escenario 5): ${latencias.join(' ms, ')} ms  | mediana ${mediana} ms`)
  }
  linea('\n(Recordá: esto mide la extracción de entidades. La latencia de extremo a')
  linea(' extremo de §5.2 incluye además la búsqueda de vuelos —medila aparte—.)')

  fs.writeFileSync(new URL('./validacion_agente_transcript.txt', import.meta.url), log.join('\n'))
  console.log('\n📄 Transcripción guardada en scripts/validacion_agente_transcript.txt')
})()
