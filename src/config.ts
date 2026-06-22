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
}

if (!config.rapidApiKey && !config.mockFlights) {
  console.warn(
    '⚠️  No hay RAPIDAPI_KEY configurada — la calculadora de vuelos va a usar datos mock.',
  )
}
