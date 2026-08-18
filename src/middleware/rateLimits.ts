// =====================================================
// Límites de tasa generales de la API.
//
// Hallazgo M-1 de la auditoría de ingeniería: el único límite que existía
// era el del login. Todo lo demás quedaba sin techo, y hay dos endpoints
// que cuestan plata o memoria en cada llamada:
//
//   - POST /api/calculadora/buscar  → pega a RapidAPI (cuota paga). Un
//     bucle de requests agota la cuota del mes en minutos.
//   - POST /api/reservas/:id/voucher y /contrato → levantan un Chromium
//     por request para generar el PDF. Varios en paralelo se llevan
//     puesta la memoria del contenedor.
//
// El almacén es en memoria: alcanza para una instancia única, que es el
// despliegue previsto. Si algún día hay más de un proceso, el límite
// pasa a ser por proceso y habría que mover el contador a Redis.
// =====================================================
import rateLimit from 'express-rate-limit'
import { Request } from 'express'
import { config } from '../config'

// Los workflows de n8n pegan server-to-server desde una IP fija y en
// ráfagas legítimas (el cron de recordatorios recorre varias reservas
// seguidas). Se los exceptúa por su API key, no por IP.
function esIntegracionInterna(req: Request): boolean {
  return Boolean(config.n8nApiKey) && req.header('x-api-key') === config.n8nApiKey
}

/** Techo general de la API. Holgado: está para frenar abuso, no uso normal. */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' || esIntegracionInterna(req),
  message: { error: 'Demasiadas solicitudes. Esperá unos minutos.' },
})

/** Endpoints que consumen cuota externa o levantan un navegador. */
export const operacionesCarasRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: esIntegracionInterna,
  message: {
    error: 'Demasiadas búsquedas o emisiones de documentos seguidas. Esperá unos minutos.',
  },
})
