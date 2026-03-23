import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import clientesRouter from './routes/clientes'
import viajesRouter from './routes/viajes'
import tramosRouter from './routes/tramos'
import cotizacionesRouter from './routes/cotizaciones'
import reservasRouter from './routes/reservas'
import adminUsersRouter from './routes/adminUsers'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Rutas
app.use('/api/clientes', clientesRouter)
app.use('/api/viajes', viajesRouter)
app.use('/api/tramos', tramosRouter)
app.use('/api/cotizaciones', cotizacionesRouter)
app.use('/api/reservas', reservasRouter)
app.use('/api/admin-users', adminUsersRouter)

// Health check
app.get('/api', (req, res) => res.json({ message: 'API funcionando ✅' }))

// Handler global de errores
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Error interno del servidor' })
})

const PORT = process.env.PORT ?? 3000
app.listen(PORT, () => console.log(`Server corriendo en puerto ${PORT}`))
