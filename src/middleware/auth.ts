// =====================================================
// Middleware de autenticación.
//
// Acepta DOS formas de acceso:
//   1) Header "Authorization: Bearer <jwt>"  → admins logueados (front).
//   2) Header "x-api-key: <N8N_API_KEY>"     → workflows de n8n
//      (server-to-server, no tiene usuario ni sesión).
//
// Si AUTH_ENABLED=false (modo demo), este middleware deja pasar todo
// sin chequear nada — el login sigue emitiendo JWT igual, para que el
// front ya lo pueda usar, pero nada se bloquea todavía.
// =====================================================
import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config'

export interface AuthRequest extends Request {
  admin?: { id: number; email: string }
}

// Rutas que siempre quedan públicas, auth habilitada o no.
const PUBLIC_PATHS: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/api' },
  // Fase M4: el monitoreo (y n8n) le pegan a esto sin JWT ni x-api-key.
  { method: 'GET', path: '/api/health' },
  { method: 'POST', path: '/api/admin-users/login' },
]

// Fase S3: la descarga de un documento (voucher/contrato) llega por un
// link de WhatsApp/email al cliente final, que no tiene JWT ni x-api-key.
// Queda pública porque la protección real es la firma HMAC + vencimiento
// que valida la propia ruta (ver routes/documentos.ts y lib/documentos.ts).
const PUBLIC_PATH_PATTERNS: Array<{ method: string; regex: RegExp }> = [
  { method: 'GET', regex: /^\/api\/documentos\/[^/]+\/descargar$/ },
]

function isPublic(req: Request): boolean {
  if (PUBLIC_PATHS.some((p) => p.method === req.method && req.path === p.path)) return true
  return PUBLIC_PATH_PATTERNS.some((p) => p.method === req.method && p.regex.test(req.path))
}

// Hallazgo M-7: la comparación de la API key se hacía con `===`, que
// corta apenas encuentra el primer carácter distinto y por lo tanto tarda
// distinto según cuánto se acertó. Es el ejemplo de manual de comparación
// de secretos: se hace en tiempo constante. El riesgo real a través de la
// red es bajo, pero el arreglo es de tres líneas y ya se usa el mismo
// criterio para las firmas de documentos (lib/documentos.ts).
function apiKeyValida(recibida: string): boolean {
  if (!config.n8nApiKey) return false
  const a = Buffer.from(recibida, 'utf8')
  const b = Buffer.from(config.n8nApiKey, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// Hallazgo M-5: se fija el algoritmo esperado en lugar de aceptar el que
// venga declarado en el propio token. No hay una explotación conocida con
// un secreto simétrico, pero dejar que el atacante elija el algoritmo de
// verificación es exactamente el patrón que habilita la confusión de
// algoritmos, y fijarlo no cuesta nada.
function verificarToken(token: string): { id: number; email: string } {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as {
    id: number
    email: string
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!config.authEnabled) return next()
  if (isPublic(req)) return next()

  const apiKey = req.header('x-api-key')
  if (apiKey) {
    if (apiKeyValida(apiKey)) return next()
    return res.status(401).json({ error: 'API key inválida' })
  }

  const authHeader = req.header('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta autenticación (Bearer token o x-api-key)' })
  }

  const token = authHeader.slice('Bearer '.length)
  try {
    const payload = verificarToken(token)
    req.admin = { id: payload.id, email: payload.email }
    return next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// Fase S6: gestionar admins (alta/edición/baja) es una operación
// privilegiada — un workflow de n8n con la x-api-key filtrada no debería
// poder crear un admin nuevo. A diferencia de requireAuth (que acepta
// x-api-key O Bearer), este middleware exige específicamente un Bearer
// de un admin logueado. Se aplica encima de requireAuth, solo en las
// rutas de mutación de adminUsers.ts (no en GET ni en /login).
export function requireAdminBearer(req: AuthRequest, res: Response, next: NextFunction) {
  if (!config.authEnabled) return next()

  const authHeader = req.header('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ error: 'Esta operación requiere una sesión de administrador (Bearer token); no acepta x-api-key' })
  }

  const token = authHeader.slice('Bearer '.length)
  try {
    const payload = verificarToken(token)
    req.admin = { id: payload.id, email: payload.email }
    return next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
