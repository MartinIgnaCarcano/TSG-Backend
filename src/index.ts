import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config'
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

const app = express()

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

// Health check
app.get('/api', (req, res) => res.json({ message: 'API funcionando ✅' }))

// Handler global de errores. Nunca devuelve err.message ni err.stack al
// cliente: un error de Prisma (P2002, nombre de columna/tabla, etc.) no
// debe filtrarse en la respuesta HTTP. El detalle completo solo va al
// log del server.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err)

  const isCorsRejection = typeof err?.message === 'string' && err.message.startsWith('Origen no permitido por CORS')
  if (isCorsRejection) {
    res.status(403).json({ error: 'Origen no permitido' })
    return
  }

  res.status(500).json({ error: 'Error interno del servidor' })
})

const server = app.listen(config.port, () => {
  console.log(`✅ Server corriendo en http://localhost:${config.port}`)
  console.log(`   API:          http://localhost:${config.port}/api`)
  console.log(`   Destinos:     http://localhost:${config.port}/api/destinos`)
  console.log(`   Cotizaciones: http://localhost:${config.port}/api/cotizaciones`)
  console.log(`   Reservas:     http://localhost:${config.port}/api/reservas`)
})

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ El puerto ${config.port} ya está en uso. Cerrá el otro proceso o cambiá PORT en .env`)
  } else {
    console.error('❌ Error del servidor:', err)
  }
  process.exit(1)
})

// Mantener el proceso vivo (fix para Express 5 + ts-node)
process.on('SIGINT', () => {
  console.log('\n👋 Cerrando servidor...')
  server.close(() => process.exit(0))
})
