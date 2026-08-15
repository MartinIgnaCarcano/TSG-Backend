// =====================================================
// Fase M4 — Health check real. El viejo `GET /api` mentía: respondía 200
// aunque Postgres estuviera caído (solo confirmaba que Express estaba
// arriba). Este endpoint hace un `SELECT 1` real contra la base con
// Prisma: si la DB no responde, devuelve 503 en vez de un 200 falso.
// Pensado para que n8n / el monitoreo de la demo le peguen a este
// endpoint en vez de a `/api`.
// =====================================================
import { Router } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/', async (req, res) => {
  const start = process.hrtime.bigint()
  try {
    await prisma.$queryRaw`SELECT 1`
    const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000
    res.status(200).json({
      status: 'ok',
      db: 'up',
      uptime: process.uptime(),
    })
    req.log?.debug({ latencyMs }, 'health check: DB ok')
  } catch (e: any) {
    req.log?.error({ err: e }, 'health check: DB no responde')
    res.status(503).json({
      status: 'error',
      db: 'down',
      uptime: process.uptime(),
    })
  }
})

export default router
