// ============================================================
// Importa los diálogos redactados por los evaluadores externos
// (planilla TSV) al corpus casos_validacion.json — Tesis STG
//
// Uso:  node scripts/importar_casos.mjs aportes_ext1.tsv ext1
//
// La planilla la completa el evaluador, NO el equipo. Columnas:
//   parte      A (cotización) | B (fuera de dominio)
//   turnos     mensajes separados por " || "
//   origen     nombre de ciudad de origen (solo parte A)
//   destino    nombre de ciudad de destino (solo parte A)
//   iata_o     código IATA esperado de origen (lo completa el equipo)
//   iata_d     código IATA esperado de destino (lo completa el equipo)
//   fecha_ida  YYYY-MM-DD o MM-DD
//   fecha_vta  YYYY-MM-DD o MM-DD
//   ambigua    x si la ciudad tiene más de un aeropuerto y no la aclaró
//
// IMPORTANTE: origen/destino/fechas los escribe el EVALUADOR al redactar
// el diálogo, antes de ver ninguna respuesta del agente. Eso es lo que
// convierte su expectativa en ground truth y no en una racionalización
// posterior. El equipo solo traduce ciudad → código IATA.
// ============================================================
import fs from 'fs'

const [archivo, autor] = process.argv.slice(2)
if (!archivo || !autor) {
  console.error('Uso: node scripts/importar_casos.mjs <planilla.tsv> <ext1|ext2|ext3>')
  process.exit(1)
}
if (autor === 'equipo') {
  console.error('❌ Este script es para aportes externos. Los casos del equipo van directo al JSON.')
  process.exit(1)
}

const txt = fs.readFileSync(new URL(archivo, import.meta.url), 'utf8').trim()
const filas = txt.split('\n').map((l) => l.split('\t'))
const cab = filas[0].map((s) => s.trim().toLowerCase())
const col = (n) => cab.indexOf(n)
const req = ['parte', 'turnos']
for (const r of req) if (col(r) < 0) { console.error(`❌ Falta la columna "${r}"`); process.exit(1) }

const corpusURL = new URL('./casos_validacion.json', import.meta.url)
const corpus = JSON.parse(fs.readFileSync(corpusURL))
const existentes = new Set(corpus.casos.map((c) => c.id))

const nuevos = []
const problemas = []
let nA = 0, nB = 0

filas.slice(1).forEach((f, i) => {
  const g = (n) => (col(n) >= 0 ? (f[col(n)] || '').trim() : '')
  const parte = g('parte').toUpperCase()
  const turnos = g('turnos').split('||').map((s) => s.trim()).filter(Boolean)
  if (!turnos.length) return
  const fila = i + 2

  if (parte === 'B') {
    nB++
    const id = `6.${nB}.${autor}`
    if (existentes.has(id)) { problemas.push(`fila ${fila}: id ${id} ya existe`); return }
    nuevos.push({ id, esc: 6, autor, turns: turnos, fuera: true })
    return
  }
  if (parte !== 'A') { problemas.push(`fila ${fila}: parte "${parte}" no reconocida (usar A o B)`); return }

  nA++
  const ambigua = !!g('ambigua')
  // escenario: 4 si es ambigua; 2 si tiene varios turnos; 1 si es un turno.
  // La columna opcional "esc" permite reclasificar a mano — típicamente al
  // escenario 3 cuando el evaluador escribió con errores de tipeo, que es
  // justamente lo que se busca que pase de forma espontánea.
  const escManual = g('esc')
  const esc = escManual ? Number(escManual) : ambigua ? 4 : turnos.length > 1 ? 2 : 1
    if (![1, 2, 3, 4, 5, 7].includes(esc)) { problemas.push(`fila ${fila}: esc "${escManual}" inválido (1..5, 7)`); return }
  const id = `${esc}.${nA}.${autor}`
  if (existentes.has(id)) { problemas.push(`fila ${fila}: id ${id} ya existe`); return }

  if (ambigua) { nuevos.push({ id, esc: 4, autor, turns: turnos, ambigua: true }); return }

    // Escenario 7 — consulta incompleta. El evaluador no aportó todos los datos:
  // falta el origen, la fecha viene sin día, ya venció, o el pedido es
  // multitramo. La expectativa NO es un conjunto de campos sino una conducta
  // —pedir lo que falta, advertir la fecha vencida, derivar el multitramo—,
  // fijada en EXPECTATIVAS_EXTERNOS.md antes de la corrida. El equipo no
  // completa lo que el evaluador no dijo. Se codifica a mano.
  if (esc === 7) { nuevos.push({ id, esc: 7, autor, turns: turnos, incompleta: true }); return }
  const oi = g('iata_o').toUpperCase(), di = g('iata_d').toUpperCase()
  const fi = g('fecha_ida'), fv = g('fecha_vta')
  const falta = []
  if (!/^[A-Z]{3}$/.test(oi)) falta.push('iata_o')
  if (!/^[A-Z]{3}$/.test(di)) falta.push('iata_d')
  if (!/^(\d{4}-)?\d{2}-\d{2}$/.test(fi)) falta.push('fecha_ida')
  if (!/^(\d{4}-)?\d{2}-\d{2}$/.test(fv)) falta.push('fecha_vta')
  if (falta.length) { problemas.push(`fila ${fila}: falta o mal formado → ${falta.join(', ')}`); return }

  nuevos.push({ id, esc, autor, turns: turnos, oi, di, fi, fv })
})

if (problemas.length) {
  console.error(`\n⚠️  ${problemas.length} fila(s) con problemas — NO se importó nada:`)
  for (const p of problemas) console.error('   · ' + p)
  console.error('\nCorregí la planilla y volvé a correr. Importar a medias deja el corpus inconsistente.')
  process.exit(1)
}

corpus.casos.push(...nuevos)
fs.writeFileSync(corpusURL, JSON.stringify(corpus, null, 2))

const porEsc = nuevos.reduce((a, c) => ((a[c.esc] = (a[c.esc] || 0) + 1), a), {})
console.log(`✅ Importados ${nuevos.length} diálogos de "${autor}"`)
for (const e of Object.keys(porEsc).sort()) console.log(`   Escenario ${e}: ${porEsc[e]}`)

const tot = corpus.casos.length
const ext = corpus.casos.filter((c) => c.autor !== 'equipo')
const extExtr = ext.filter((c) => c.esc !== 6).length
const totExtr = corpus.casos.filter((c) => c.esc !== 6).length
console.log(`\nCorpus: ${tot} diálogos (${totExtr} de extracción, ${tot - totExtr} de contención)`)
console.log(`Externos: ${ext.length} (${extExtr} de extracción)`)
if (totExtr < 100) console.log(`⚠️  Faltan ${100 - totExtr} diálogos de extracción para llegar a los 100 del plan.`)
if (extExtr < 40) console.log(`⚠️  Faltan ${40 - extExtr} diálogos de extracción EXTERNOS para llegar al mínimo de 40.`)
