import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import fs from 'fs'
import pinoHttp from 'pino-http'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { config } from './config'
import { logger } from './lib/logger'
import { requireAuth } from './middleware/auth'
import { TransicionInvalidaError } from './services/reservas.service'
import clientesRouter from './routes/clientes'
import viajesRouter from './routes/viajes'
import tramosRouter from './routes/tramos'
import cotizacionesRouter from './routes/cotizaciones'
import reservasRouter from './routes/reservas'
import adminUsersRouter from './routes/adminUsers'
import destinosRouter from './routes/destinos'
import calculadoraRouter from './routes/calculadora'
import recordatoriosRouter from './routes/recordatorios'
import parametrosRouter from './routes/parametros'
import hotelesRouter from './routes/hoteles'
import pasajerosRouter from './routes/pasajeros'
import documentosRouter from './routes/documentos'
import pagosRouter from './routes/pagos'
import estadisticasRouter from './routes/estadisticas'
import healthRouter from './routes/health'

const app = express()

// Fase M4 — log estructurado de cada request con request-id correlacionable
// (header `x-request-id` si el cliente lo manda, o uno generado). Reemplaza
// los console.log/console.error sueltos del server: `req.log` (dentro de
// cada ruta/middleware) y `logger` (fuera de un request) escriben con el
// mismo formato — pretty en dev, JSON puro si NODE_ENV=production.
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = req.headers['x-request-id']
      const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID()
      res.setHeader('x-request-id', id)
      return id
    },
  }),
)

app.use(helmet())

// CORS acotado: permite la lista configurada (front servido por un dev
// server local) y los casos sin Origin —front vanilla abierto con
// doble-click (file://) y n8n, que pega server-to-server—. No es un
// wildcard abierto a cualquier sitio.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error(`Origen no permitido por CORS: ${origin}`))
    },
  }),
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Documentos generados (vouchers/contratos) — Fase S3. Ya NO se sirven
// como estático público: tienen DNI y fecha de nacimiento del pasajero
// (Ley 25.326) y un estático así no expira ni se puede revocar. Se
// descargan por GET /api/documentos/:id/descargar con URL firmada
// (HMAC-SHA256 + vencimiento) — ver routes/documentos.ts y
// lib/documentos.ts.

// Auth global: si AUTH_ENABLED=false (default, modo demo) deja pasar
// todo sin chequear nada. Cuando se active, exige Bearer JWT o
// x-api-key (n8n) salvo en las rutas públicas (health + login).
app.use(requireAuth)

// Rutas
app.use('/api/clientes', clientesRouter)
app.use('/api/viajes', viajesRouter)
app.use('/api/tramos', tramosRouter)
app.use('/api/cotizaciones', cotizacionesRouter)
app.use('/api/reservas', reservasRouter)
app.use('/api/admin-users', adminUsersRouter)
app.use('/api/destinos', destinosRouter)
app.use('/api/calculadora', calculadoraRouter)
app.use('/api/recordatorios', recordatoriosRouter)
app.use('/api/parametros', parametrosRouter)
app.use('/api/hoteles', hotelesRouter)
app.use('/api/pasajeros', pasajerosRouter)
app.use('/api/documentos', documentosRouter)
app.use('/api/pagos', pagosRouter)
app.use('/api/estadisticas', estadisticasRouter)
app.use('/api/health', healthRouter)

// Ping simple (no chequea la DB) — se mantiene por compatibilidad; para
// monitoreo real usar GET /api/health (Fase M4).
app.get('/api', (req, res) => res.json({ message: 'API funcionando ✅' }))

// =====================================================
// Fase M3 — servir el build del front React (opcional, "un solo origen").
// Se activa solo si FRONT_DIST_DIR está seteada en .env; si no, el back
// sigue siendo API-only (comportamiento actual, sin cambios). Pensado para
// `npm run build` del front (Front/STG-Sistema-de-gesti-n-de-viajes-/react)
// apuntando FRONT_DIST_DIR a esa carpeta `dist`, y así levantar todo con
// un solo proceso (sin CORS, sin ngrok para el front en la demo).
// =====================================================
if (config.frontDistDir) {
  const distDir = path.resolve(config.frontDistDir)

  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    logger.warn(
      { frontDistDir: config.frontDistDir },
      'FRONT_DIST_DIR no tiene index.html (¿corriste "npm run build" en el front?). No se sirve el front.',
    )
  } else {
    // Assets del build (JS/CSS/imágenes con hash) servidos tal cual.
    app.use(express.static(distDir))

    // Fallback SPA: cualquier GET que no sea /api ni /storage devuelve
    // index.html para que React Router resuelva la ruta client-side (ej.
    // refrescar en /reservas no debe dar 404). No es una ruta con patrón
    // (evita cualquier lío de sintaxis de path-to-regexp en Express 5):
    // es un middleware que chequea el path a mano y sigue de largo si no
    // le corresponde.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/storage')) {
        next()
        return
      }
      res.sendFile(path.join(distDir, 'index.html'))
    })

    logger.info({ distDir }, 'Front servido desde el back (FRONT_DIST_DIR)')
  }
}

// Handler global de errores (Fase S1). Nunca devuelve err.message ni
// err.stack al cliente: un error de Prisma (P2002, nombre de columna/tabla,
// etc.) no debe filtrarse en la respuesta HTTP. El detalle completo solo va
// al log del server. Las rutas ya no arman la respuesta de error: hacen
// `catch (e) { next(e) }` y todo el mapeo de errores conocidos vive acá,
// en un único lugar.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  ;(req.log ?? logger).error({ err, method: req.method, url: req.originalUrl }, 'Error no manejado')

  const isCorsRejection = typeof err?.message === 'string' && err.message.startsWith('Origen no permitido por CORS')
  if (isCorsRejection) {
    res.status(403).json({ error: 'Origen no permitido' })
    return
  }

  // Transición de estado inválida (máquina de estados de Reserva): el
  // mensaje es seguro, no expone internals.
  if (err instanceof TransicionInvalidaError) {
    res.status(409).json({ error: err.message })
    return
  }

  // Zod, por si alguno se escapa del middleware validateBody.
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.issues.map((i) => ({ campo: i.path.join('.') || '(body)', mensaje: i.message })),
    })
    return
  }

  // Errores conocidos de Prisma: se mapean a un mensaje genérico, nunca se
  // devuelve err.message (filtraria nombre de tabla/columna).
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({ error: 'Ya existe un registro con ese valor' })
        return
      case 'P2025':
        res.status(404).json({ error: 'Registro no encontrado' })
        return
      case 'P2003':
        res.status(409).json({ error: 'El registro está referenciado por otros datos' })
        return
    }
  }

  res.status(500).json({ error: 'Error interno del servidor' })
})

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      urls: {
        api: `http://localhost:${config.port}/api`,
        health: `http://localhost:${config.port}/api/health`,
        destinos: `http://localhost:${config.port}/api/destinos`,
        cotizaciones: `http://localhost:${config.port}/api/cotizaciones`,
        reservas: `http://localhost:${config.port}/api/reservas`,
      },
    },
    'Server corriendo',
  )
})

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    logger.error({ port: config.port }, 'El puerto ya está en uso. Cerrá el otro proceso o cambiá PORT en .env')
  } else {
    logger.error({ err }, 'Error del servidor')
  }
  process.exit(1)
})

// Mantener el proceso vivo (fix para Express 5 + ts-node)
process.on('SIGINT', () => {
  logger.info('Cerrando servidor...')
  server.close(() => process.exit(0))
})
