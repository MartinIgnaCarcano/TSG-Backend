// ============================================================
// Validación AMPLIADA del agente conversacional — Tesis STG
// Sustituye a scripts/validar_agente.mjs para la corrida definitiva.
//
// Qué agrega respecto del script anterior:
//   1. Corpus externo (casos_validacion.json) con PROCEDENCIA por diálogo
//      → reporta la tasa desagregada equipo / externos (mata el sesgo
//        de familiaridad declarado en §3.8 y §6.3).
//   2. Verifica las FECHAS de verdad, no solo su formato. El script
//      anterior daba por correcto cualquier 'YYYY-MM-DD'; con eso, dos
//      de las cuatro entidades nunca se estaban evaluando.
//   3. Métrica por ranura (slot filling): aciertos sobre 4 entidades × N
//      diálogos, con precisión, exhaustividad y F1 → magnitud comparable
//      en orden con el F1 de la literatura de NER (resuelve §6.2).
//   4. Intervalos de Wilson calculados en la corrida.
//   5. Hash SHA-256 del system prompt en la transcripción → evidencia
//      auditable de que el prompt NO se tocó entre corridas.
//   6. Salida JSON legible por máquina + transcripción humana.
//   7. Modo --mock: corre todo el pipeline sin API, para probar.
//
// Uso:
//   GROQ_API_KEY=gsk_xxx node scripts/validar_agente_ampliado.mjs
//   node scripts/validar_agente_ampliado.mjs --mock          (prueba en seco)
//   ... --solo-esc 6        (corre un solo escenario)
//   ... --etiqueta piloto   (sufijo para los archivos de salida)
// ============================================================
import fs from 'fs'
import crypto from 'crypto'

const ARGV = process.argv.slice(2)
const flag = (n) => ARGV.includes(n)
const val = (n, d) => { const i = ARGV.indexOf(n); return i >= 0 ? ARGV[i + 1] : d }

const MOCK = flag('--mock')
const SOLO_ESC = val('--solo-esc', null)
const ETIQUETA = val('--etiqueta', 'definitiva')
const HOY = new Date().toISOString().slice(0, 10)

const KEY = process.env.GROQ_API_KEY
if (!KEY && !MOCK) {
  console.error('❌ Falta GROQ_API_KEY.  Corré:  GROQ_API_KEY=tu_key node scripts/validar_agente_ampliado.mjs')
  console.error('   (o probá el pipeline sin API con:  node scripts/validar_agente_ampliado.mjs --mock)')
  process.exit(1)
}
const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const TEMP = Number(process.env.GROQ_TEMP ?? 0.2)
const DELAY = Number(process.env.DELAY_MS ?? 6000)

// ---------- system prompt exacto de producción ----------
// OJO: workflows/Bot_STG_Twilio_n8n.json es una copia vieja (declara
// llama-3.3-70b-versatile, ya discontinuado). El workflow vigente es el de
// workflows/produccion/. Se busca ese primero y se informa cuál se leyó, para
// que la transcripción deje constancia de la procedencia del prompt.
const CANDIDATOS = [
  process.env.WORKFLOW,
  '../workflows/produccion/Bot_STG_Twilio_n8n.CORREGIDO.json',
  '../workflows/produccion/Bot_STG_Twilio_n8n.json',
  '../workflows/Bot_STG_Twilio_n8n.CORREGIDO.json',
  '../workflows/Bot_STG_Twilio_n8n.json',
].filter(Boolean)

let SYS = ''
let SYS_HASH = 'mock'
let WF_USADO = '(mock)'
if (!MOCK) {
  let ruta = null
  for (const c of CANDIDATOS) {
    try { fs.accessSync(new URL(c, import.meta.url)); ruta = c; break } catch {}
  }
  if (!ruta) {
    console.error('❌ No encontré ningún workflow del bot. Probé:')
    for (const c of CANDIDATOS) console.error('   · ' + c)
    console.error('   Pasá la ruta a mano con:  WORKFLOW=../ruta/al.json')
    process.exit(1)
  }
  WF_USADO = ruta
  const wf = JSON.parse(fs.readFileSync(new URL(ruta, import.meta.url)))
  const agente = wf.nodes.find((n) => n.name === 'AI Agent Vendedor')
  if (!agente) { console.error(`❌ ${ruta} no tiene un nodo "AI Agent Vendedor".`); process.exit(1) }
  // aviso si el modelo declarado en el workflow no es el que se va a invocar
  const nodoModelo = wf.nodes.find((n) => typeof n?.parameters?.model === 'string')
  const modeloWf = nodoModelo?.parameters?.model
  if (modeloWf && modeloWf !== (process.env.GROQ_MODEL || 'openai/gpt-oss-120b')) {
    console.warn(`⚠️  El workflow declara "${modeloWf}" pero se va a invocar "${process.env.GROQ_MODEL || 'openai/gpt-oss-120b'}".`)
    console.warn('    Verificá que estés leyendo el workflow vigente antes de reportar estos resultados.')
  }
  SYS = agente.parameters.options.systemMessage
    .replace(/^=/, '')
    .replace(/\{\{\s*DateTime\.now\(\)\.toFormat\('yyyy-MM-dd'\)\s*\}\}/g, HOY)
  // El hash se calcula sobre el prompt SIN la fecha inyectada, que cambia
  // cada día. Así el hash es estable entre corridas mientras el prompt no
  // se modifique — que es exactamente lo que hay que poder demostrar.
  SYS_HASH = crypto.createHash('sha256').update(SYS.replace(HOY, '<FECHA>')).digest('hex').slice(0, 16)
}

// ---------- corpus ----------
const corpus = JSON.parse(fs.readFileSync(new URL('./casos_validacion.json', import.meta.url)))
let CASOS = corpus.casos
if (SOLO_ESC) CASOS = CASOS.filter((c) => String(c.esc) === String(SOLO_ESC))

const sinAutor = CASOS.filter((c) => !c.autor)
if (sinAutor.length) {
  console.error(`❌ ${sinAutor.length} caso(s) sin campo "autor": ${sinAutor.map((c) => c.id).join(', ')}`)
  console.error('   La procedencia es obligatoria: sin ella no se puede reportar la tasa externa.')
  process.exit(1)
}
const ids = CASOS.map((c) => c.id)
const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
if (dup.length) { console.error(`❌ ids duplicados: ${[...new Set(dup)].join(', ')}`); process.exit(1) }

// ---------- utilidades ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 'MM-DD' → próxima ocurrencia >= hoy.  'YYYY-MM-DD' → literal.
function resolverFecha(spec) {
  if (Array.isArray(spec)) return spec.flatMap(resolverFecha)
  const s = String(spec || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return [s]
  const m = s.match(/^(\d{2})-(\d{2})$/)
  if (!m) return []
  const [, mes, dia] = m
  const anio = Number(HOY.slice(0, 4))
  const este = `${anio}-${mes}-${dia}`
  // aceptamos el año en curso y el siguiente: "del 10 de agosto" dicho en
  // agosto es genuinamente ambiguo y no queremos penalizar esa lectura.
  return este >= HOY ? [este, `${anio + 1}-${mes}-${dia}`] : [`${anio + 1}-${mes}-${dia}`, este]
}

function extraerJSON(text) {
  const m = String(text).match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
const pideAeropuerto = (t) => /ezeiza|aeroparque|\beze\b|\baep\b|aeropuerto|cu[áa]l de los/i.test(String(t))

function wilson(x, n, z = 1.959963985) {
  if (!n) return [0, 0]
  const p = x / n, d = 1 + (z * z) / n
  const c = p + (z * z) / (2 * n)
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))
  return [(100 * (c - s)) / d, (100 * (c + s)) / d]
}
const pct = (x, n) => (n ? ((100 * x) / n).toFixed(1) : '0.0')
const ic = (x, n) => { const [a, b] = wilson(x, n); return `[${a.toFixed(1)}%, ${b.toFixed(1)}%]` }

// ---------- llamada al modelo ----------
async function ask(messages) {
  if (MOCK) {
    await sleep(5)
    const ult = messages.filter((m) => m.role === 'user').pop()?.content || ''
    return { out: `[MOCK] respuesta simulada a: ${ult.slice(0, 40)}`, ms: 700, error: false }
  }
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
      console.log(`   ⏳ límite de Groq, espero ${Math.round(espera / 1000)}s...`)
      await sleep(espera)
      continue
    }
    const out = j.choices?.[0]?.message?.content
    if (out == null) return { out: 'ERROR: ' + JSON.stringify(j).slice(0, 200), ms, error: true }
    return { out, ms, error: false }
  }
  return { out: 'ERROR: rate limit persistente', ms: 0, error: true }
}

// ---------- evaluación por ranura ----------
// Devuelve el detalle de las 4 entidades para poder computar tanto el
// criterio binario de la Tabla 6 como las métricas de slot filling.
function evaluarRanuras(c, texto) {
  const j = extraerJSON(texto)
  const esperado = {
    origenIATA: [c.oi],
    destinoIATA: [c.di],
    fechaIda: resolverFecha(c.fi),
    fechaVuelta: resolverFecha(c.fv),
  }
  const det = {}
  for (const k of Object.keys(esperado)) {
    const obt = j?.[k] ?? null
    const esp = esperado[k]
    const producida = obt != null && String(obt).trim() !== ''
    let ok = false
    if (producida) {
      if (k.startsWith('fecha')) ok = esFecha(obt) && (esp.length === 0 || esp.includes(String(obt)))
      else ok = String(obt).toUpperCase() === String(esp[0] || '').toUpperCase()
    }
    det[k] = { esperado: esp, obtenido: obt, producida, ok }
  }
  return { json: j, det }
}

function veredictoBinario(c, texto, ranuras) {
    // Escenario 7 — consulta incompleta. El evaluador no aportó todos los datos:
  // falta el origen, la fecha viene sin día, ya venció, o el pedido es
  // multitramo. La expectativa NO es un conjunto de campos sino una conducta
  // —pedir lo que falta, advertir la fecha vencida, derivar el multitramo—,
  // fijada en EXPECTATIVAS_EXTERNOS.md antes de la corrida. El equipo no
  // completa lo que el evaluador no dijo. Se codifica a mano.
  if (c.esc === 7) return 'REVISAR'
  if (c.esc === 4) return !ranuras.json && pideAeropuerto(texto) ? 'EXITO' : 'FALLA'
  if (c.esc === 6) return 'REVISAR' // juicio humano — ver codificar_esc6.mjs
  const todas = Object.values(ranuras.det).every((r) => r.ok)
  return todas ? 'EXITO' : 'FALLA'
}

// ---------- corrida ----------
const log = []
const linea = (s = '') => { console.log(s); log.push(s) }

;(async () => {
  linea(`Validación ampliada del agente — Tesis STG`)
  linea(`Modelo: ${MODEL}   temperatura: ${TEMP}   fecha de corrida: ${HOY}`)
  linea(`Workflow leído: ${WF_USADO}`)
  linea(`Hash del system prompt (SHA-256, 16): ${SYS_HASH}`)
  linea(`Etiqueta de corrida: ${ETIQUETA}${MOCK ? '   [MODO MOCK — sin API]' : ''}`)
  linea(`Diálogos en el corpus: ${CASOS.length}`)
  linea('='.repeat(66))
  linea('NOTA: el hash del prompt permite demostrar que no se modificó entre')
  linea('corridas. Si cambia, la comparación entre corridas deja de ser válida.')
  linea('='.repeat(66))

  const res = []
  for (const c of CASOS) {
    const messages = MOCK ? [] : [{ role: 'system', content: SYS }]
    let lastMs = 0, finalText = '', huboError = false
    linea(`\n[${c.id}] Escenario ${c.esc} · autor: ${c.autor}`)
    const enviar = async (txt) => {
      messages.push({ role: 'user', content: txt })
      const { out, ms, error } = await ask(messages)
      messages.push({ role: 'assistant', content: out })
      lastMs = ms; finalText = out; if (error) huboError = true
      linea(`  👤 ${txt}`)
      linea(`  🤖 (${ms} ms) ${String(out).replace(/\s+/g, ' ').slice(0, 240)}`)
      if (!MOCK) await sleep(DELAY)
    }
    for (const t of c.turns) await enviar(t)

    const esExtraccion = [1, 2, 3, 5].includes(c.esc)
    if (esExtraccion && !huboError && !extraerJSON(finalText)) {
      await enviar('Sí, es correcto. Buscá los vuelos por favor.')
    }

    const r = { id: c.id, esc: c.esc, autor: c.autor, error: huboError, ms: lastMs, texto: finalText }
    if (huboError) {
      r.veredicto = 'NO_EVALUADO'
      linea('  ➜ ⚠️ NO EVALUADO (error de API)')
    } else if (esExtraccion) {
      const ran = evaluarRanuras(c, finalText)
      r.ranuras = ran.det
      r.veredicto = veredictoBinario(c, finalText, ran)
      const fallas = Object.entries(ran.det).filter(([, v]) => !v.ok)
      linea(`  ➜ ${r.veredicto === 'EXITO' ? '✅ ÉXITO' : '❌ FALLA'}`)
      for (const [k, v] of fallas) {
        linea(`     · ${k}: esperaba ${JSON.stringify(v.esperado)} · obtuvo ${JSON.stringify(v.obtenido)}`)
      }
      if (c.latencia) r.latencia = lastMs
    } else {
      const ran = evaluarRanuras(c, finalText)
      r.veredicto = veredictoBinario(c, finalText, ran)
      linea(`  ➜ ${r.veredicto === 'REVISAR' ? '⚠️ REVISAR (codificación humana)' : r.veredicto === 'EXITO' ? '✅ ÉXITO' : '❌ FALLA'}`)
    }
    res.push(r)
  }

  // ---------- agregados ----------
  const extraccion = res.filter((r) => [1, 2, 3, 4, 5].includes(r.esc) && r.veredicto !== 'NO_EVALUADO')
  const contencion = res.filter((r) => r.esc === 6)
  const errores = res.filter((r) => r.veredicto === 'NO_EVALUADO')

  const okExtr = extraccion.filter((r) => r.veredicto === 'EXITO').length
  const nExtr = extraccion.length

  linea('\n' + '='.repeat(66))
  linea('INDICADOR 1 — Precisión de extracción y desambiguación (escenarios 1 a 5)')
  linea(`  Global:   ${okExtr}/${nExtr} = ${pct(okExtr, nExtr)}%   IC 95% Wilson ${ic(okExtr, nExtr)}`)
  linea(`  Umbral fijado a priori (Tabla 4): 80%`)

  // desagregado por procedencia — este es el número que desactiva el sesgo
  const porAutor = {}
  for (const r of extraccion) {
    const grupo = r.autor === 'equipo' ? 'equipo' : 'externos'
    porAutor[grupo] = porAutor[grupo] || { n: 0, ok: 0 }
    porAutor[grupo].n++
    if (r.veredicto === 'EXITO') porAutor[grupo].ok++
  }
  linea('\n  Desagregado por procedencia del diálogo:')
  for (const g of ['equipo', 'externos']) {
    const s = porAutor[g]
    if (!s) { linea(`    ${g.padEnd(10)}: sin diálogos`); continue }
    linea(`    ${g.padEnd(10)}: ${s.ok}/${s.n} = ${pct(s.ok, s.n)}%   IC 95% ${ic(s.ok, s.n)}`)
  }
  if (!porAutor.externos) {
    linea('    ⚠️  SIN DIÁLOGOS EXTERNOS: el sesgo de familiaridad de §3.8 sigue')
    linea('        intacto y la ampliación muestral no lo subsana.')
  }

  linea('\n  Por escenario:')
  for (const e of [1, 2, 3, 4, 5]) {
    const g = extraccion.filter((r) => r.esc === e)
    if (g.length) linea(`    Escenario ${e}: ${g.filter((r) => r.veredicto === 'EXITO').length}/${g.length}`)
  }

  // ---------- métricas por ranura (slot filling) ----------
  const conRanuras = extraccion.filter((r) => r.ranuras)
  if (conRanuras.length) {
    let tp = 0, fp = 0, fn = 0, total = 0
    const porEntidad = {}
    for (const r of conRanuras) {
      for (const [k, v] of Object.entries(r.ranuras)) {
        total++
        porEntidad[k] = porEntidad[k] || { n: 0, ok: 0 }
        porEntidad[k].n++
        if (v.ok) { tp++; porEntidad[k].ok++ }
        else if (v.producida) fp++   // produjo un valor, pero equivocado
        else fn++                    // no produjo el valor
      }
    }
    const prec = tp + fp ? tp / (tp + fp) : 0
    const rec = tp + fn ? tp / (tp + fn) : 0
    const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0
    linea('\n' + '-'.repeat(66))
    linea('MÉTRICA POR RANURA (slot filling) — comparable en orden con el F1 de NER')
    linea(`  Ranuras evaluadas: ${total} (${conRanuras.length} diálogos × 4 entidades)`)
    linea(`  Aciertos ${tp} · valor erróneo ${fp} · valor ausente ${fn}`)
    linea(`  Precisión ${prec.toFixed(3)} · Exhaustividad ${rec.toFixed(3)} · F1 ${f1.toFixed(3)}`)
    linea('  Por entidad:')
    for (const [k, s] of Object.entries(porEntidad)) {
      linea(`    ${k.padEnd(14)}: ${s.ok}/${s.n} = ${pct(s.ok, s.n)}%   IC 95% ${ic(s.ok, s.n)}`)
    }
    linea('  NOTA: reportar esta métrica ADEMÁS de la binaria por diálogo es lo que')
    linea('  habilita la comparación de orden de magnitud con Fudholi et al. (§6.2).')
  }

  linea('\n' + '-'.repeat(66))
  linea('INDICADOR 2 — Contención del dominio (escenario 6)')
  linea(`  ${contencion.length} diálogo(s) pendientes de codificación humana.`)
  linea('  Corré:  node scripts/codificar_esc6.mjs   (doble codificación + κ de Cohen)')
  const extCont = contencion.filter((r) => r.autor !== 'equipo').length
  linea(`  Procedencia: ${contencion.length - extCont} del equipo · ${extCont} externos`)
  if (!extCont) {
    linea('  ⚠️  Sin consultas adversariales externas, el 20/20 sigue siendo circular')
    linea('      (conjunto construido después de conocer el modo de falla, §3.8).')
  }

  linea('\nNo se reporta una tasa agregada sobre el total de diálogos: los escenarios')
  linea('1–5 y el 6 miden constructos con criterios de éxito de naturaleza opuesta')
  linea('y la definición operacional de la Tabla 4 no autoriza a sumarlos.')

  const lat = res.filter((r) => r.latencia).map((r) => r.latencia)
  if (lat.length) {
    const s = [...lat].sort((a, b) => a - b)
    linea(`\nLatencia de inferencia del modelo: ${lat.join(' ms, ')} ms · mediana ${s[Math.floor(s.length / 2)]} ms`)
  }
  if (errores.length) {
    linea(`\n⚠️  ${errores.length} diálogo(s) no evaluados por error de API: ${errores.map((r) => r.id).join(', ')}`)
    linea('    Volvé a correrlos o subí DELAY_MS. NO los cuentes como falla ni los omitas en silencio.')
  }

  // ---------- salidas ----------
  const base = `validacion_${ETIQUETA}_${HOY}`
  fs.writeFileSync(new URL(`./${base}.txt`, import.meta.url), log.join('\n'))
  fs.writeFileSync(
    new URL(`./${base}.json`, import.meta.url),
    JSON.stringify({ modelo: MODEL, temperatura: TEMP, fecha: HOY, promptHash: SYS_HASH, etiqueta: ETIQUETA, resultados: res }, null, 2)
  )
  // planilla de codificación ciega para el escenario 6
  if (contencion.length) {
    const filas = ['id\tautor\tconsulta\trespuesta_del_agente\tcod_A\tcod_B']
    for (const r of contencion) {
      const c = CASOS.find((x) => x.id === r.id)
      filas.push([r.id, r.autor, c.turns.join(' | '), String(r.texto).replace(/\s+/g, ' ').slice(0, 400), '', ''].join('\t'))
    }
    fs.writeFileSync(new URL(`./codificacion_esc6_${HOY}.tsv`, import.meta.url), filas.join('\n'))
    console.log(`\n📋 Planilla de codificación: scripts/codificacion_esc6_${HOY}.tsv`)
    console.log('   Dos personas completan cod_A y cod_B por separado (1 = declinó, 0 = respondió sustantivamente).')
  }
  console.log(`\n📄 Transcripción: scripts/${base}.txt`)
  console.log(`📊 Resultados:    scripts/${base}.json`)
})()
