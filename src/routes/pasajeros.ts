// =====================================================
// Fase B — Pasajero (1‑N con Reserva). Modelo aparte del Cliente: una
// reserva puede llevar varios viajeros, cada uno con su propio documento,
// requeridos para emitir el voucher (POST /reservas/:id/voucher).
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { validateBody } from '../middleware/validate'
import { crearPasajeroSchema, actualizarPasajeroSchema } from '../schemas/pasajero.schema'

const router = Router()

// GET /api/pasajeros?reservaId=...
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservaId = req.query.reservaId as string | undefined
    const pasajeros = await prisma.pasajero.findMany({
      where: { baja: null, ...(reservaId && { reservaId }) },
      orderBy: [{ esTitular: 'desc' }, { alta: 'asc' }],
    })
    res.json(pasajeros)
  } catch (e) {
    next(e)
  }
})

// GET /api/pasajeros/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pasajero = await prisma.pasajero.findUnique({ where: { id: req.params.id as string } })
    if (!pasajero) return res.status(404).json({ error: 'Pasajero no encontrado' })
    res.json(pasajero)
  } catch (e) {
    next(e)
  }
})

// POST /api/pasajeros
router.post('/', validateBody(crearPasajeroSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pasajero = await prisma.pasajero.create({ data: req.body })
    res.status(201).json(pasajero)
  } catch (e) {
    next(e)
  }
})

// PUT /api/pasajeros/:id
router.put('/:id', validateBody(actualizarPasajeroSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pasajero = await prisma.pasajero.update({
      where: { id: req.params.id as string },
      data: req.body,
    })
    res.json(pasajero)
  } catch (e) {
    next(e)
  }
})

// DELETE lógico /api/pasajeros/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pasajero = await prisma.pasajero.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(pasajero)
  } catch (e) {
    next(e)
  }
})

export default router
