// =====================================================
// Logger centralizado (Fase M4). Reemplaza los console.log/console.error
// sueltos del server por logs estructurados con pino:
//   - NODE_ENV=production → JSON puro (una línea por evento, para
//     cualquier agregador de logs).
//   - Resto (dev/test) → "pretty" legible en la terminal, vía pino-pretty.
// El request-id (para correlacionar todas las líneas de un mismo request)
// lo agrega pino-http en index.ts, no este archivo.
// =====================================================
import pino from 'pino'

const isProd = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  // Hallazgo C-3 de la auditoría de ingeniería: el serializador de
  // request de pino incluye `headers`, así que cada línea de log de
  // pino-http escribía el `Authorization: Bearer <jwt>` del admin y la
  // `x-api-key` de n8n en texto plano. Cualquiera con acceso al panel de
  // logs se llevaba una sesión válida y la clave de integración. Se
  // eliminan del log (no se enmascaran: no hay razón para conservarlos).
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-api-key"]',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
})
