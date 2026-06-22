import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
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

dotenv.config()

const app = express()
app.use(cors())
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

// Handler global de errores
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Error interno del servidor' })
})

const PORT = Number(process.env.PORT) || 3000

const server = app.listen(PORT, () => {
  console.log(`✅ Server corriendo en http://localhost:${PORT}`)
  console.log(`   API:          http://localhost:${PORT}/api`)
  console.log(`   Destinos:     http://localhost:${PORT}/api/destinos`)
  console.log(`   Cotizaciones: http://localhost:${PORT}/api/cotizaciones`)
  console.log(`   Reservas:     http://localhost:${PORT}/api/reservas`)
})

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ El puerto ${PORT} ya está en uso. Cerrá el otro proceso o cambiá PORT en .env`)
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
