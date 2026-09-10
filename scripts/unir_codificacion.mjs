// ============================================================
// Une las dos planillas de codificación ciega del Escenario 6 en el
// archivo combinado que espera codificar_esc6.mjs — Tesis STG
//
// Uso:
//   node scripts/unir_codificacion.mjs cod_A.tsv cod_B.tsv [salida.tsv]
//
// Verifica que ambas planillas tengan los mismos id en el mismo orden y
// que las veinte filas estén codificadas con 1 o 0. Si algo no cierra,
// aborta sin escribir nada.
// ============================================================
import fs from 'fs'

const [fa, fb, salidaArg] = process.argv.slice(2)
if (!fa || !fb) {
  console.error('Uso: node scripts/unir_codificacion.mjs <cod_A.tsv> <cod_B.tsv> [salida.tsv]')
  process.exit(1)
}

function leer(f) {
  const filas = fs.readFileSync(new URL(f, import.meta.url), 'utf8').trim().split('\n').map((l) => l.split('\t'))
  const cab = filas[0].map((s) => s.trim().toLowerCase())
  const i = (n) => cab.indexOf(n)
  for (const c of ['id', 'consulta', 'respuesta_del_agente', 'cod']) {
    if (i(c) < 0) { console.error(`❌ ${f}: falta la columna "${c}"`); process.exit(1) }
  }
  return filas.slice(1).filter((r) => r.length > i('cod') || r[i('id')]).map((r) => ({
    id: (r[i('id')] || '').trim(),
    autor: i('autor') >= 0 ? (r[i('autor')] || '').trim() : 'equipo',
    consulta: (r[i('consulta')] || '').trim(),
    respuesta: (r[i('respuesta_del_agente')] || '').trim(),
    cod: (r[i('cod')] || '').trim(),
    nota: i('nota') >= 0 ? (r[i('nota')] || '').trim() : '',
  }))
}

const A = leer(fa), B = leer(fb)
const errores = []

if (A.length !== B.length) errores.push(`distinta cantidad de filas: ${fa} tiene ${A.length}, ${fb} tiene ${B.length}`)
const n = Math.min(A.length, B.length)
for (let k = 0; k < n; k++) {
  if (A[k].id !== B[k].id) errores.push(`fila ${k + 2}: los id no coinciden (${A[k].id} vs ${B[k].id})`)
}
for (const [f, filas] of [[fa, A], [fb, B]]) {
  filas.forEach((r, k) => {
    if (!/^[01]$/.test(r.cod)) errores.push(`${f} fila ${k + 2} (${r.id}): "cod" vale "${r.cod}", tiene que ser 1 o 0`)
  })
}

if (errores.length) {
  console.error(`❌ ${errores.length} problema(s) — no se escribió nada:`)
  for (const e of errores.slice(0, 20)) console.error('   · ' + e)
  if (errores.length > 20) console.error(`   ... y ${errores.length - 20} más`)
  process.exit(1)
}

const salida = salidaArg || fa.replace(/_A\.tsv$/, '.tsv')
if (salida === fa || salida === fb) { console.error('❌ La salida pisaría una de las planillas de entrada.'); process.exit(1) }

const filas = ['id\tautor\tconsulta\trespuesta_del_agente\tcod_A\tcod_B\tnotas']
for (let k = 0; k < n; k++) {
  const notas = [A[k].nota && `A: ${A[k].nota}`, B[k].nota && `B: ${B[k].nota}`].filter(Boolean).join(' · ')
  filas.push([A[k].id, A[k].autor, A[k].consulta, A[k].respuesta, A[k].cod, B[k].cod, notas].join('\t'))
}
fs.writeFileSync(new URL(salida, import.meta.url), filas.join('\n') + '\n')

const ac = A.filter((r) => r.cod === '1').length
const bc = B.filter((r) => r.cod === '1').length
const des = A.filter((r, k) => r.cod !== B[k].cod).length
const alu = [...A, ...B].filter((r) => /alucinaci/i.test(r.nota)).length
console.log(`✅ ${salida} — ${n} filas`)
console.log(`   Codificador A: ${ac}/${n} éxitos · Codificador B: ${bc}/${n} · desacuerdos: ${des}`)
if (alu) console.log(`   Casos marcados como alucinación de servicio (R3): ${alu} marca(s)`)
console.log(`\nAhora corré:  node scripts/codificar_esc6.mjs ${salida}`)
