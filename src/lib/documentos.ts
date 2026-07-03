// =====================================================
// Generación y almacenamiento de documentos (voucher/contrato) — Fase B/C.
// Convierte HTML a PDF y lo guarda en disco, devolviendo la URL pública
// (servida como estático desde index.ts) y el hash de integridad para
// registrar en DocumentoGenerado.
//
// Dos motores posibles, en este orden de preferencia:
//   1. PDFShift (https://pdfshift.io) — si hay PDFSHIFT_API_KEY configurada.
//   2. Puppeteer local (Chromium embebido) — sin key, sin servicio externo,
//      no depende de internet ni de un signup de último momento. Es el
//      default ahora: antes, sin key, se mandaba el HTML crudo como
//      adjunto, y los clientes de mail (Gmail, etc.) no lo renderizan bien
//      como adjunto — de ahí el cambio.
// Si por algún motivo Puppeteer no puede levantar Chromium (falta alguna
// dependencia del sistema), como último recurso cae al HTML crudo en vez
// de romper la demo.
// =====================================================
import axios from 'axios'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer'
import { config } from '../config'

const STORAGE_DIR = path.join(process.cwd(), config.documentosStorageDir)

function asegurarStorageDir() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true })
}

async function htmlAPdfConPdfShift(html: string): Promise<Buffer> {
  const r = await axios.post(
    'https://api.pdfshift.io/v3/convert/pdf',
    { source: html, landscape: false, use_print: true },
    {
      auth: { username: 'api', password: config.pdfshiftApiKey! },
      responseType: 'arraybuffer',
      timeout: 30000,
    },
  )
  return Buffer.from(r.data)
}

async function htmlAPdfConPuppeteer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'a4', printBackground: true })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

async function htmlAPdfBuffer(html: string): Promise<{ buffer: Buffer; extension: 'pdf' | 'html' }> {
  if (config.pdfshiftApiKey) {
    return { buffer: await htmlAPdfConPdfShift(html), extension: 'pdf' }
  }
  try {
    return { buffer: await htmlAPdfConPuppeteer(html), extension: 'pdf' }
  } catch (e: any) {
    console.warn('⚠️  No se pudo generar el PDF con Puppeteer, se guarda como HTML:', e.message)
    return { buffer: Buffer.from(html, 'utf-8'), extension: 'html' }
  }
}

export interface DocumentoGuardado {
  archivo: string // nombre de archivo en disco
  url: string // URL pública relativa, ej: /storage/documentos/voucher-RES-123-169...pdf
  hash: string // sha256 del contenido, para integridad (DocumentoGenerado.hash)
  extension: 'pdf' | 'html'
}

/**
 * Genera el PDF (o HTML en modo mock) a partir de un HTML ya renderizado
 * y lo guarda en disco. `prefijo` identifica el documento en el nombre de
 * archivo (ej. `voucher-RES-1719...`).
 */
export async function generarYGuardarDocumento(html: string, prefijo: string): Promise<DocumentoGuardado> {
  asegurarStorageDir()
  const { buffer, extension } = await htmlAPdfBuffer(html)
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  const archivo = `${prefijo}-${Date.now()}.${extension}`
  fs.writeFileSync(path.join(STORAGE_DIR, archivo), buffer)
  return { archivo, url: `/storage/documentos/${archivo}`, hash, extension }
}

// Ya no hay un modo "mock" real: sin PDFSHIFT_API_KEY se usa Puppeteer
// local, que genera PDF igual. Queda en false salvo que ni Puppeteer pueda
// levantar Chromium (caso excepcional, manejado en htmlAPdfBuffer).
export const documentosMock = false

// =====================================================
// Fase S3 — URLs firmadas para documentos.
// Los vouchers/contratos tienen DNI y fecha de nacimiento del pasajero;
// antes se servían como estático público sin expiración ni revocación
// (Ley 25.326). Ahora se entregan por una URL de capacidad: quien tiene
// el link puede descargar el archivo, pero el link vence y no se puede
// forjar sin el secreto del server.
//   sig = HMAC-SHA256(id + exp, DOCS_URL_SECRET)
// =====================================================
function firmar(id: string, exp: number): string {
  return crypto.createHmac('sha256', config.docsUrlSecret).update(`${id}${exp}`).digest('hex')
}

/**
 * Arma la URL pública y firmada para descargar un documento por su id
 * (`DocumentoGenerado.id`). Vence a las `ttlHoras` horas (default 72).
 */
export function firmarUrlDocumento(id: string, ttlHoras = 72): string {
  const exp = Math.floor(Date.now() / 1000) + Math.round(ttlHoras * 3600)
  const sig = firmar(id, exp)
  return `${config.publicBaseUrl}/api/documentos/${id}/descargar?exp=${exp}&sig=${sig}`
}

/**
 * Valida que `sig` corresponda a `id` + `exp` (comparación a tiempo
 * constante) y que `exp` no haya vencido. Devuelve false ante cualquier
 * firma alterada, id distinto o link vencido.
 */
export function validarFirmaDocumento(id: string, exp: number, sig: string): boolean {
  if (!id || !sig) return false
  if (!Number.isFinite(exp) || exp <= 0) return false
  if (exp < Math.floor(Date.now() / 1000)) return false

  const esperado = Buffer.from(firmar(id, exp), 'hex')
  let recibido: Buffer
  try {
    recibido = Buffer.from(sig, 'hex')
  } catch {
    return false
  }
  if (esperado.length !== recibido.length) return false
  return crypto.timingSafeEqual(esperado, recibido)
}

/**
 * Versión "pública" de un DocumentoGenerado para exponer por API: el
 * `url` interno (ruta relativa en disco) se reemplaza por el link
 * firmado y con vencimiento. Se firma en el momento de la consulta, no
 * al generarse el documento, para que cada lectura tenga un TTL fresco.
 */
export function urlPublicaDocumento(documento: { id: string; url: string | null }): string | null {
  return documento.url ? firmarUrlDocumento(documento.id) : null
}
