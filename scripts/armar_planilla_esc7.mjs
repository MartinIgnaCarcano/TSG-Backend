import fs from 'fs'

const archivo = process.argv[2]
if (!archivo) {
  console.error('Uso: node scripts/armar_planilla_esc7.mjs <validacion_<etiqueta>_<fecha>.json>')
  process.exit(1)
}

// Reglas fijadas a priori. NO se modifican despues de ver las respuestas.
const REGLAS = {
  '7.1.ext1': ['R-A + R-C', 'Pide el origen Y el dia concreto.'],
  '7.2.ext1': ['R-D', 'Reconoce que es multitramo (tres ciudades) y deriva al equipo comercial.'],
  '7.1.ext2': ['R-A', 'Extrae MDZ y GRU, y pide el dia concreto.'],
  '7.2.ext2': ['R-A + R-B', 'Advierte que mayo de 2026 ya paso y pide una fecha nueva.'],
  '7.3.ext2': ['R-A + R-B', 'Advierte que marzo de 2026 ya paso y pide una fecha nueva.'],
  '7.1.ext3': ['Esc. 4 + R-A', 'Pide el aeropuerto de Buenos Aires Y el dia concreto.'],
  '7.2.ext3': ['R-A', 'Extrae Mendoza y Mallorca, y pide el dia concreto.'],
  '7.3.ext3': ['Esc. 4 + R-A', 'Pide el aeropuerto de Buenos Aires Y fechas concretas.'],
  '7.1.ext4': ['R-A', 'Extrae Mendoza y Cancun, y pide el dia concreto.'],
  '7.2.ext4': ['R-C + R-A', 'Pide el origen Y las fechas.'],
  '7.3.ext4': ['R-C + R-A', 'Pide el origen Y las fechas.'],
}

const res = JSON.parse(fs.readFileSync(new URL(archivo, import.meta.url), 'utf8'))
const corpus = JSON.parse(fs.readFileSync(new URL('./casos_validacion.json', import.meta.url), 'utf8'))
const porId = Object.fromEntries(corpus.casos.map((c) => [c.id, c]))
const limpio = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim()

const filas = [['id', 'autor', 'regla', 'esperado', 'consulta', 'respuesta', 'cod_A', 'cod_B'].join('\t')]
let n = 0
for (const r of res.resultados.filter((x) => x.esc === 7)) {
  const [regla, esperado] = REGLAS[r.id] || ['(sin regla)', '(ver EXPECTATIVAS_EXTERNOS.md)']
  const caso = porId[r.id]
  filas.push([r.id, r.autor, regla, esperado, limpio((caso?.turns || []).join(' || ')), limpio(r.texto), '', ''].join('\t'))
  n++
}

const salida = `codificacion_esc7_${res.fecha}.tsv`
fs.writeFileSync(new URL(`./${salida}`, import.meta.url), filas.join('\n') + '\n')
console.log(`OK ${salida} — ${n} casos`)