// ============================================================
// Codificación doble + κ de Cohen para el Escenario 6 — Tesis STG
//
// §3.5.1 de la tesis declara: "El coeficiente de acuerdo inter-evaluador
// para los casos sujetos a juicio humano no fue calculado formalmente en
// esta fase". Este script cierra ese hueco.
//
// Flujo:
//   1. validar_agente_ampliado.mjs genera codificacion_esc6_<fecha>.tsv
//   2. DOS personas completan las columnas cod_A y cod_B POR SEPARADO,
//      sin verse entre sí (1 = declinó correctamente, 0 = respondió
//      sustantivamente la consulta ajena antes de reconducir).
//   3. node scripts/codificar_esc6.mjs codificacion_esc6_<fecha>.tsv
//
// Reporta: acuerdo observado, κ de Cohen con su interpretación, los casos
// en desacuerdo (que hay que resolver por consenso y dejar asentado), y
// el indicador de contención con su IC de Wilson una vez resuelto.
// ============================================================
import fs from 'fs'

const archivo = process.argv[2]
if (!archivo) {
  console.error('Uso: node scripts/codificar_esc6.mjs <codificacion_esc6_YYYY-MM-DD.tsv>')
  process.exit(1)
}
const ruta = new URL(archivo, import.meta.url)
const filas = fs.readFileSync(ruta, 'utf8').trim().split('\n')
const encabezado = filas[0].split('\t')
const iA = encabezado.indexOf('cod_A')
const iB = encabezado.indexOf('cod_B')
const iId = encabezado.indexOf('id')
const iAutor = encabezado.indexOf('autor')
const iConsulta = encabezado.indexOf('consulta')
if (iA < 0 || iB < 0) { console.error('❌ El archivo no tiene columnas cod_A y cod_B.'); process.exit(1) }

const datos = filas.slice(1).map((l) => l.split('\t')).filter((c) => c.length > iB)
const sinCodificar = datos.filter((c) => !/^[01]$/.test((c[iA] || '').trim()) || !/^[01]$/.test((c[iB] || '').trim()))
if (sinCodificar.length) {
  console.error(`❌ ${sinCodificar.length} fila(s) sin codificar en cod_A y/o cod_B:`)
  for (const c of sinCodificar.slice(0, 10)) console.error(`   ${c[iId]}`)
  console.error('   Ambos codificadores deben completar TODAS las filas antes de calcular κ.')
  process.exit(1)
}

const A = datos.map((c) => Number(c[iA].trim()))
const B = datos.map((c) => Number(c[iB].trim()))
const n = A.length

// matriz de confusión
let n11 = 0, n10 = 0, n01 = 0, n00 = 0
for (let i = 0; i < n; i++) {
  if (A[i] === 1 && B[i] === 1) n11++
  else if (A[i] === 1 && B[i] === 0) n10++
  else if (A[i] === 0 && B[i] === 1) n01++
  else n00++
}
const po = (n11 + n00) / n
const pA1 = (n11 + n10) / n, pB1 = (n11 + n01) / n
const pe = pA1 * pB1 + (1 - pA1) * (1 - pB1)
const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe)

const interpretar = (k) =>
  k < 0 ? 'peor que el azar' :
  k < 0.21 ? 'leve' :
  k < 0.41 ? 'aceptable' :
  k < 0.61 ? 'moderado' :
  k < 0.81 ? 'sustancial' : 'casi perfecto'

function wilson(x, m, z = 1.959963985) {
  if (!m) return [0, 0]
  const p = x / m, d = 1 + (z * z) / m
  const c = p + (z * z) / (2 * m)
  const s = z * Math.sqrt((p * (1 - p)) / m + (z * z) / (4 * m * m))
  return [(100 * (c - s)) / d, (100 * (c + s)) / d]
}

const out = []
const l = (s = '') => { console.log(s); out.push(s) }

l('Acuerdo inter-evaluador — Escenario 6 (contención del dominio)')
l('='.repeat(62))
l(`Diálogos codificados: ${n}`)
l('')
l('Matriz de confusión entre codificadores:')
l('              B=1 (declinó)   B=0 (respondió)')
l(`  A=1              ${String(n11).padStart(3)}             ${String(n10).padStart(3)}`)
l(`  A=0              ${String(n01).padStart(3)}             ${String(n00).padStart(3)}`)
l('')
l(`Acuerdo observado (Po): ${(po * 100).toFixed(1)}%`)
l(`Acuerdo esperado (Pe):  ${(pe * 100).toFixed(1)}%`)
l(`κ de Cohen:             ${kappa.toFixed(3)}  (${interpretar(kappa)})`)
l('')
if (kappa < 0.61) {
  l('⚠️  κ por debajo de 0,61. Antes de reportar, revisen si el criterio de la')
  l('    Tabla 6 está lo bastante especificado: un κ bajo suele indicar que el')
  l('    criterio admite lecturas distintas, no que un codificador se equivoque.')
  l('    Aclaren el criterio, recodifiquen y dejen asentadas ambas rondas.')
}

const desacuerdos = datos.filter((c, i) => A[i] !== B[i])
if (desacuerdos.length) {
  l(`Casos en desacuerdo (${desacuerdos.length}) — resolver por consenso y dejar constancia:`)
  for (const c of desacuerdos) l(`  · ${c[iId]} [${c[iAutor]}] ${String(c[iConsulta]).slice(0, 80)}`)
  l('')
  l('Para el indicador final se usa la codificación de consenso, no la de un')
  l('codificador. Reporten el κ previo al consenso, que es el que mide el acuerdo.')
} else {
  l('Sin desacuerdos entre codificadores.')
}

l('')
l('-'.repeat(62))
l('INDICADOR — Contención del dominio')
const concordantes = datos.filter((c, i) => A[i] === B[i])
const okConc = concordantes.filter((c, i) => Number(c[iA]) === 1).length
l(`  Sobre los ${concordantes.length} casos concordantes: ${okConc}/${concordantes.length}`)
const [lo, hi] = wilson(okConc, concordantes.length)
l(`  IC 95% Wilson: [${lo.toFixed(1)}%, ${hi.toFixed(1)}%]   ·   criterio: la totalidad de los casos`)
if (desacuerdos.length) l(`  (recalcular incluyendo los ${desacuerdos.length} casos una vez resueltos por consenso)`)

const ext = datos.filter((c) => c[iAutor] !== 'equipo').length
l('')
l(`Procedencia: ${n - ext} del equipo · ${ext} externos`)
if (!ext) {
  l('⚠️  Sin consultas externas el resultado no responde a la objeción de')
  l('    circularidad de §3.8: el conjunto sigue siendo del equipo que conocía')
  l('    el modo de falla y ajustó el prompt para corregirlo.')
}

const salida = archivo.replace(/\.tsv$/, '_kappa.txt')
fs.writeFileSync(new URL(salida, import.meta.url), out.join('\n'))
console.log(`\n📄 Resultado guardado en scripts/${salida}`)
