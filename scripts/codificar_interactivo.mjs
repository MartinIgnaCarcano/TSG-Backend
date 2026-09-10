// ============================================================
// Codificación asistida por consola — Tesis STG
//
// Muestra un caso por vez y espera 1 / 0. Evita abrir el TSV en una
// planilla de cálculo, que en la codificación anterior desplazó valores
// entre columnas y obligó a recuperarlos a mano.
//
// Cada codificador corre esto con SU columna y sin ver la del otro.
//
// Uso:
//   node scripts/codificar_interactivo.mjs codificacion_esc6_2026-08-24.tsv cod_A
//   node scripts/codificar_interactivo.mjs codificacion_esc7_2026-08-24.tsv cod_B
//
// Teclas:  1 = éxito · 0 = falla · s = saltear · d = deshacer · q = guardar y salir
// Guarda después de cada respuesta: si se corta, se retoma donde quedó.
// ============================================================
import fs from 'fs'
import readline from 'node:readline/promises'

const [archivo, columna] = process.argv.slice(2)
if (!archivo || !['cod_A', 'cod_B'].includes(columna || '')) {
  console.error('Uso: node scripts/codificar_interactivo.mjs <planilla.tsv> <cod_A|cod_B>')
  process.exit(1)
}

const ruta = new URL(archivo, import.meta.url)
const leer = () => fs.readFileSync(ruta, 'utf8').replace(/\n$/, '').split('\n').map((l) => l.split('\t'))
let filas = leer()
const cab = filas[0]
const col = cab.indexOf(columna)
if (col < 0) { console.error(`❌ La planilla no tiene la columna ${columna}.`); process.exit(1) }
const idx = (n) => cab.indexOf(n)

const guardar = () => fs.writeFileSync(ruta, filas.map((f) => f.join('\t')).join('\n') + '\n')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const envolver = (s, ancho = 76) =>
  String(s ?? '').replace(new RegExp(`(.{1,${ancho}})(\\s|$)`, 'g'), '$1\n').trimEnd()

console.log(`\nCodificando ${archivo} — columna ${columna}`)
console.log('1 = el agente hizo lo esperado · 0 = no lo hizo · s = saltear · d = deshacer · q = salir\n')

const hechas = []
let i = 1
while (i < filas.length) {
  const f = filas[i]
  if (/^[01]$/.test((f[col] || '').trim())) { i++; continue }

  const pend = filas.slice(1).filter((x) => !/^[01]$/.test((x[col] || '').trim())).length
  console.log('─'.repeat(78))
  console.log(`${f[idx('id')]}   ·   autor: ${f[idx('autor')]}   ·   faltan ${pend}`)
  if (idx('regla') >= 0) {
    console.log(`\nREGLA     ${f[idx('regla')]}`)
    console.log(`ESPERADO  ${envolver(f[idx('esperado')])}`)
  }
  console.log(`\n👤 ${envolver(f[idx('consulta')])}`)
  console.log(`\n🤖 ${envolver(f[idx('respuesta')])}\n`)

  const r = (await rl.question('   [1/0/s/d/q] ')).trim().toLowerCase()
  if (r === 'q') break
  if (r === 's') { i++; continue }
  if (r === 'd') {
    const ult = hechas.pop()
    if (ult == null) { console.log('   (no hay nada que deshacer)\n'); continue }
    filas[ult][col] = ''
    guardar()
    i = ult
    continue
  }
  if (r !== '1' && r !== '0') { console.log('   Respondé 1, 0, s, d o q.\n'); continue }

  f[col] = r
  hechas.push(i)
  guardar()
  i++
}

rl.close()
const faltan = filas.slice(1).filter((x) => !/^[01]$/.test((x[col] || '').trim())).length
console.log('─'.repeat(78))
console.log(faltan
  ? `Guardado. Quedan ${faltan} sin codificar — volvé a correrlo cuando quieras.`
  : `Guardado. ${columna} está completa.`)