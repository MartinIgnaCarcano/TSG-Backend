// =====================================================
// Config centralizada — se valida al arrancar el server.
// Si falta algo crítico, el proceso no levanta (fail fast)
// en vez de fallar más tarde con un error críptico de Prisma
// o de un fetch a una API externa.
// =====================================================
import dotenv from 'dotenv'

dotenv.config()

function required(name: string): string {
  const value = process.env[name]
  if (!value || value.trim() === '') {
    throw new Error(
      `❌ Falta la variable de entorno ${name}. Revisá tu archivo .env (ver .env.example).`,
    )
  }
  return value
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const parsed = Number(raw)
  if (Number.isNaN(parsed)) {
    throw new Error(`❌ La variable de entorno ${name} debe ser numérica (valor actual: "${raw}").`)
  }
  return parsed
}

function optionalBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw.trim() === '') return fallback
  return raw.trim().toLowerCase() === 'true'
}

function parseList(name: string, fallback: string[]): string[] {
  const raw = process.env[name]
  if (!raw || raw.trim() === '') return fallback
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// Orígenes de front permitidos por CORS. El front vanilla se abre con
// doble-click (file://, no manda Origin) y n8n pega server-to-server
// (tampoco manda Origin) — esos casos siempre se permiten en index.ts.
// Esta lista cubre cuando el front se sirve desde un servidor local
// (Live Server, Vite, etc.). Configurable por env sin tocar código.
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: optionalNumber('PORT', 3001),
  databaseUrl: required('DATABASE_URL'),
  corsOrigins: parseList('CORS_ORIGINS', DEFAULT_CORS_ORIGINS),

  // Búsqueda de vuelos (calculadora). Si no hay key, lib/flights.ts
  // cae a modo mock automáticamente — no es obligatoria.
  rapidApiKey: process.env.RAPIDAPI_KEY,
  rapidApiFlightsHost: process.env.RAPIDAPI_FLIGHTS_HOST ?? 'google-flights2.p.rapidapi.com',
  mockFlights: optionalBoolean('MOCK_FLIGHTS', false),

  // Auth — el login SIEMPRE emite JWT (para que el front lo pueda usar
  // ya mismo), pero el middleware solo lo EXIGE si AUTH_ENABLED=true.
  // Default false: no rompe la demo ni los workflows de n8n existentes
  // hasta que el front (React, Fase R1) sepa mandar el token.
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  authEnabled: optionalBoolean('AUTH_ENABLED', false),
  // n8n se autentica con esta API key fija (header x-api-key), no con JWT.
  n8nApiKey: process.env.N8N_API_KEY,

  // Documentos (vouchers/contratos) — Fase B/C. Sin key, lib/documentos.ts
  // cae a modo mock (guarda HTML en vez de PDF), igual que MOCK_FLIGHTS.
  pdfshiftApiKey: process.env.PDFSHIFT_API_KEY,
  documentosStorageDir: process.env.DOCUMENTOS_STORAGE_DIR ?? 'storage/documentos',

  // Almacenamiento remoto de documentos (Supabase Storage). Necesario en
  // plataformas cuyo sistema de archivos es efímero: en el plan gratuito de
  // Render el disco se reinicia con cada suspensión o redespliegue, así que
  // los vouchers y contratos emitidos desaparecerían. Si estas dos variables
  // están definidas, lib/documentos.ts guarda y lee los archivos allí; si no,
  // sigue usando el disco local exactamente como hasta ahora (desarrollo).
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,
  documentosBucket: process.env.DOCUMENTOS_BUCKET ?? 'documentos',

  // Fase S3 — los vouchers/contratos tienen DNI y fecha de nacimiento
  // (Ley 25.326): ya no se sirven como estático público sin vencimiento.
  // Se firman con HMAC-SHA256(id + exp, DOCS_URL_SECRET) — ver
  // lib/documentos.ts. Requerida siempre (no depende de AUTH_ENABLED).
  docsUrlSecret: required('DOCS_URL_SECRET'),
  // Host público con el que se arman los links firmados que van por
  // WhatsApp/email. En local, http://localhost:<PORT> (mismo host que
  // hoy asume Flujo7 al armar el link).
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${optionalNumber('PORT', 3001)}`,

  // Webhook de n8n que dispara WhatsApp + email apenas se emite un
  // voucher/contrato (disparo inmediato al apretar el botón, en vez de
  // esperar al cron de Flujo3 — ver routes/reservas.ts). Fire-and-forget:
  // si n8n no está levantado, no debe romper la respuesta al front.
  n8nWebhookDocumentoUrl:
    process.env.N8N_WEBHOOK_DOCUMENTO_URL ?? 'http://localhost:5678/webhook/documento-emitido',

  // Fase M3 — sirve el build del front React (carpeta `dist` generada por
  // `npm run build`) directamente desde este Express, con fallback SPA a
  // index.html. Sin esta variable, el comportamiento no cambia: el back
  // sigue siendo API-only, como hoy. Ver README.md.
  frontDistDir: process.env.FRONT_DIST_DIR,
}

if (!config.pdfshiftApiKey) {
  console.warn(
    '⚠️  No hay PDFSHIFT_API_KEY configurada — los vouchers/contratos se generan con Puppeteer (Chromium local) en vez de PDFShift.',
  )
}

if (!config.rapidApiKey && !config.mockFlights) {
  console.warn(
    '⚠️  No hay RAPIDAPI_KEY configurada — la calculadora de vuelos va a usar datos mock.',
  )
}

if (config.authEnabled && !config.n8nApiKey) {
  throw new Error(
    '❌ AUTH_ENABLED=true pero falta N8N_API_KEY — los workflows de n8n se quedarían sin acceso. Configurá N8N_API_KEY en .env.',
  )
}

if (!config.authEnabled) {
  console.warn(
    '⚠️  AUTH_ENABLED=false — la API sigue abierta sin autenticación (modo demo). El login ya emite JWT para cuando se active.',
  )
}
