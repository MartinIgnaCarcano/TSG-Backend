// =====================================================
// /api/recordatorios — usado por el Flujo 3 (cron 9 AM)
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/recordatorios?pendientes=true&fecha=YYYY-MM-DD
// Devuelve los recordatorios cuya fechaProgramada <= fin del día indicado
// y que aún no se ejecutaron. Si no se pasa fecha, usa hoy.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fechaStr = (req.query.fecha as string | undefined) || new Date().toISOString().slice(0, 10)
    const pendientes = req.query.pendientes === 'true'
    const reservaId = req.query.reservaId as string | undefined

    const finDelDia = new Date(fechaStr + 'T23:59:59Z')

    const recordatorios = await prisma.recordatorio.findMany({
      where: {
        ...(pendientes && { ejecutado: false }),
        ...(pendientes && { fechaProgramada: { lte: finDelDia } }),
        ...(reservaId && { reservaId }),
      },
      include: {
        reserva: {
          include: {
            cliente: true,
            cotizacion: {
              include: {
                viaje: {
                  include: { origen: true, destino: true },
                },
              },
            },
          },
        },
      },
      orderBy: { fechaProgramada: 'asc' },
    })
    res.json(recordatorios)
  } catch (e) {
    next(e)
  }
})

// GET /api/recordatorios/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.recordatorio.findUnique({
      where: { id: req.params.id as string },
      include: { reserva: { include: { cliente: true } } },
    })
    if (!r) return res.status(404).json({ error: 'Recordatorio no encontrado' })
    res.json(r)
  } catch (e) {
    next(e)
  }
})

// PATCH /api/recordatorios/:id/ejecutar — el Flujo 3 lo llama después de enviar
router.patch('/:id/ejecutar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resultado } = req.body
    const r = await prisma.recordatorio.update({
      where: { id: req.params.id as string },
      data: {
        ejecutado: true,
        fechaEjecucion: new Date(),
        resultado: resultado || 'OK',
      },
    })
    res.json(r)
  } catch (e) {
    next(e)
  }
})

// DELETE /api/recordatorios/:id — borrar definitivamente
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.recordatorio.delete({ where: { id: req.params.id as string } })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// POST /api/recordatorios — crear uno manualmente (poco común)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservaId, tipo, fechaProgramada } = req.body
    const r = await prisma.recordatorio.create({
      data: { reservaId, tipo, fechaProgramada: new Date(fechaProgramada) },
    })
    res.status(201).json(r)
  } catch (e) {
    next(e)
  }
})

export default router
