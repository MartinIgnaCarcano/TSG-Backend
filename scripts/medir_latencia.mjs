// ============================================================
// Medición de latencia del flujo de cotización (Tesis STG — §5.2)
// Cronometra el componente de búsqueda de vuelos (endpoint
// /api/calculadora/buscar, que ejecuta la misma lógica que el bot:
// 5 variantes de fecha en paralelo contra Google Flights) y lo suma
// a la inferencia del LLM ya medida, para estimar la latencia de
// extremo a extremo de manera precisa y reproducible.
//
// Uso (con el back levantado y RAPIDAPI_KEY configurada):
//   node scripts/medir_latencia.mjs
//   RUNS=5 API_BASE=http://localhost:3001/api node scripts/medir_latencia.mjs
//
// Nota: para que la latencia sea representativa, MOCK_FLIGHTS debe estar
// en false y la cuota de Google Flights disponible (si devuelve 0
// opciones por cuota agotada, el tiempo NO es representativo).
// ============================================================

const BASE = process.env.API_BASE || 'http://localhost:3001/api'
const RUNS = Number(process.env.RUNS ?? 5)
const LLM_MS = Number(process.env.LLM_MS ?? 650) // inferencia del LLM ya medida (validar_agente.mjs)

const rutas = [
  { origenIATA: 'EZE', destinoIATA: 'MAD', fechaIda: '2026-08-10', fechaVuelta: '2026-08-20' },
  { origenIATA: 'MDZ', destinoIATA: 'MIA', fechaIda: '2026-09-05', fechaVuelta: '2026-09-15' },
  { origenIATA: 'COR', destinoIATA: 'CUN', fechaIda: '2026-10-02', fechaVuelta: '2026-10-12' },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function medir(ruta) {
  const t0 = Date.now()
  let ok = false, n = 0, err = null
  try {
    const r = await fetch(BASE + '/calculadora/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ruta),
    })
    const j = await r.json()
    n = (j.opciones || []).length
    ok = r.ok && n > 0
    if (!ok) err = j.error || `sin opciones (HTTP ${r.status})`
  } catch (e) { err = e.message }
  return { ms: Date.now() - t0, ok, n, err }
}

;(async () => {
  console.log(`\n⏱️  Latencia de búsqueda contra ${BASE}  (${RUNS} corridas)\n`)
  const tiempos = []
  for (let i = 0; i < RUNS; i++) {
    const ruta = rutas[i % rutas.length]
    const { ms, ok, n, err } = await medir(ruta)
    const e2e = ms + LLM_MS
    console.log(`  Corrida ${i + 1}: ${ruta.origenIATA}→${ruta.destinoIATA}  búsqueda ${(ms / 1000).toFixed(1)}s` +
      (ok ? `  (${n} opciones)  | extremo a extremo ≈ ${((e2e) / 1000).toFixed(1)}s` : `  ⚠️ ${err}`))
    if (ok) tiempos.push(ms)
    await sleep(1500)
  }
  console.log('\n' + '─'.repeat(50))
  if (tiempos.length === 0) {
    console.log('❌ Ninguna corrida devolvió opciones. Revisá RAPIDAPI_KEY / cuota / MOCK_FLIGHTS.')
    console.log('   (La latencia solo es representativa con la búsqueda real funcionando.)')
    return
  }
  const sorted = [...tiempos].sort((a, b) => a - b)
  const mediana = sorted[Math.floor(sorted.length / 2)]
  const min = sorted[0], max = sorted[sorted.length - 1]
  const e2eMed = mediana + LLM_MS
  console.log(`Corridas válidas: ${tiempos.length}/${RUNS}`)
  console.log(`Búsqueda de vuelos  → min ${(min/1000).toFixed(1)}s · mediana ${(mediana/1000).toFixed(1)}s · max ${(max/1000).toFixed(1)}s`)
  console.log(`Inferencia LLM      → ~${(LLM_MS/1000).toFixed(1)}s por turno (medido en validar_agente.mjs)`)
  console.log(`Extremo a extremo (búsqueda + LLM) → mediana ≈ ${(e2eMed/1000).toFixed(1)} s`)
  console.log('\nResumen para §5.2:')
  console.log(`  "El tiempo de la consulta tarifaria (cinco fechas en paralelo) registró una mediana de`)
  console.log(`   ${(mediana/1000).toFixed(1)} s sobre ${tiempos.length} corridas; sumada la inferencia del modelo (~${(LLM_MS/1000).toFixed(1)} s),`)
  console.log(`   la latencia de extremo a extremo hasta la comparativa fue de aproximadamente ${(e2eMed/1000).toFixed(1)} s."`)
  console.log('')
})()
