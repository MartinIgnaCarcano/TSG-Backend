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
