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
import jwt from 'jsonwebtoken'
import { config } from '../config'

export interface AuthRequest extends Request {
  admin?: { id: number; email: string }
}

// Rutas que siempre quedan públicas, auth habilitada o no.
const PUBLIC_PATHS: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/api' },
  { method: 'POST', path: '/api/admin-users/login' },
]

function isPublic(req: Request): boolean {
  return PUBLIC_PATHS.some((p) => p.method === req.method && req.path === p.path)
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!config.authEnabled) return next()
  if (isPublic(req)) return next()

  const apiKey = req.header('x-api-key')
  if (apiKey) {
    if (apiKey === config.n8nApiKey) return next()
    return res.status(401).json({ error: 'API key inválida' })
  }

  const authHeader = req.header('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Falta autenticación (Bearer token o x-api-key)' })
  }

  const token = authHeader.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: number; email: string }
    req.admin = { id: payload.id, email: payload.email }
    return next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
