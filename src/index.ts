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
import { prisma } from './lib/prisma'
import { requireAuth } from './middleware/auth'
import { apiRateLimit, operacionesCarasRateLimit } from './middleware/rateLimits'
import { TransicionInvalidaError } from './services/reservas.service'
import { N8nError } from './lib/n8n'
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

// Hallazgo C-4 de la auditoría de ingeniería: detrás de un proxy (Render,
// ngrok) todos los requests llegan con la IP del proxy, así que
// express-rate-limit veía una sola IP para todo el mundo. El limitador
// del login pasaba a ser global: cinco intentos fallidos de cualquiera
// dejaban a la agencia entera sin poder loguearse por quince minutos, y
// el atacante seguía probando igual. Con `trust proxy` en 1 se toma la
// IP real del primer salto (X-Forwarded-For), que es la topología tanto
// de Render como de ngrok. No se pone `true` (confiar en toda la cadena)
// porque eso permitiría falsear la IP de origen a mano.
app.set('trust proxy', 1)

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

// CSP: los defaults de helmet bloquean dos cosas que usa el front cuando
// este mismo Express lo sirve en producción: las fotos de los hoteles (vienen
// de Booking u otros dominios, siempre https) y la cotización del dólar, que
// el navegador pide a dolarapi.com.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https://dolarapi.com'],
      },
    },
  }),
)

// CORS acotado: permite la lista configurada (front servido por un dev
// server local) y los casos sin Origin —front vanilla abierto con
// doble-click (file://) y n8n, que pega server-to-server—. No es un
// wildcard abierto a cualquier sitio.
//
// Mismo origen: cuando el front lo sirve este Express (FRONT_DIST_DIR), el
// navegador igual manda `Origin` en los POST/PATCH. Ese origen es el propio
// host del back, no hace falta listarlo en CORS_ORIGINS: se acepta siempre.
app.use(
  cors((req: express.Request, callback) => {
    const origin = req.headers.origin
    const propio = `${req.protocol}://${req.headers.host}`
    if (!origin || origin === propio || config.corsOrigins.includes(origin)) {
      callback(null, { origin: true })
      return
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`))
  }),
)

// =====================================================
// Fase M3 — servir el build del front React (opcional, "un solo origen").
//
// Va ANTES de requireAuth: el HTML, el JS y el CSS del panel son públicos
// (la pantalla de login tiene que poder cargarse sin sesión). Lo que queda
// protegido es /api. Antes estaba después de la auth y, con
// AUTH_ENABLED=true en producción, el navegador recibía un 401 en vez del
// index.html.
// Se activa solo si FRONT_DIST_DIR está seteada; si no, el back sigue
// siendo API-only. En producción la imagen de Docker buildea `frontend/`
// (este mismo repo) y la deja en /app/public con FRONT_DIST_DIR apuntando
// ahí: un solo servicio, un solo origen, sin CORS. En local se puede apuntar
// a `frontend/dist` después de `npm run build`.
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

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Techo general de peticiones (hallazgo M-1). Va antes de la
// autenticación para que también cubra los intentos no autenticados, y
// exceptúa el health check y a los workflows de n8n (ver rateLimits.ts).
app.use(apiRateLimit)

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
// La calculadora consume cuota de RapidAPI en cada llamada: límite propio.
app.use('/api/calculadora', operacionesCarasRateLimit, calculadoraRouter)
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

  // Falla de un webhook de n8n llamado en forma síncrona (lib/n8n.ts): el
  // mensaje lo arma el back, no viene de afuera, así que es seguro.
  if (err instanceof N8nError) {
    res.status(err.status).json({ error: err.message })
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

// Apagado ordenado (hallazgo B-1 de la auditoría de ingeniería).
//
// Sólo se manejaba SIGINT (Ctrl+C en la terminal), pero la señal que
// mandan Docker y Render al redesplegar o al suspender el servicio es
// SIGTERM: sin este handler, cada redespliegue cortaba de golpe los
// requests en vuelo y dejaba las conexiones de Prisma abiertas hasta que
// la base las expiraba. Ahora se deja de aceptar conexiones nuevas, se
// esperan las que están en curso y recién ahí se cierra el pool.
//
// El timeout de guarda existe porque `server.close()` no termina nunca si
// alguna conexión queda colgada: pasados los 10 segundos, se sale igual.
// Es preferible a que el orquestador mate el proceso con SIGKILL.
let cerrando = false

async function apagarOrdenadamente(senal: NodeJS.Signals) {
  if (cerrando) return
  cerrando = true
  logger.info({ senal }, 'Apagando: se dejan de aceptar conexiones nuevas')

  const forzar = setTimeout(() => {
    logger.warn('El cierre ordenado tardó demasiado; se fuerza la salida')
    process.exit(1)
  }, 10_000)
  forzar.unref()

  server.close(async () => {
    try {
      await prisma.$disconnect()
      logger.info('Conexiones cerradas. Chau.')
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'Error al cerrar el pool de la base')
      process.exit(1)
    }
  })
}

process.on('SIGINT', apagarOrdenadamente)
process.on('SIGTERM', apagarOrdenadamente)
