import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/tramos?viajeId=1
router.get('/', async (req: Request, res: Response) => {
  try {
    const viajeId = req.query.viajeId ? Number(req.query.viajeId) : undefined
    const tramos = await prisma.tramo.findMany({
      where: { baja: null, ...(viajeId && { viajeId }) },
      orderBy: [{ viajeId: 'asc' }, { orden: 'asc' }],
    })
    res.json(tramos)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/tramos/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tramo = await prisma.tramo.findUnique({
      where: { id: Number(req.params.id) },
      include: { viaje: true },
    })
    if (!tramo) return res.status(404).json({ error: 'Tramo no encontrado' })
    res.json(tramo)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/tramos
router.post('/', async (req: Request, res: Response) => {
  try {
    const { aeropuertoSalida, horarioSalida, aeropuertoLlegada, horarioLlegada, orden, viajeId } = req.body
    const tramo = await prisma.tramo.create({
      data: {
        aeropuertoSalida,
        horarioSalida: new Date(horarioSalida),
        aeropuertoLlegada,
        horarioLlegada: new Date(horarioLlegada),
        orden,
        viajeId,
      },
    })
    res.status(201).json(tramo)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/tramos/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { aeropuertoSalida, horarioSalida, aeropuertoLlegada, horarioLlegada, orden } = req.body
    const tramo = await prisma.tramo.update({
      where: { id: Number(req.params.id) },
      data: {
        aeropuertoSalida,
        ...(horarioSalida && { horarioSalida: new Date(horarioSalida) }),
        aeropuertoLlegada,
        ...(horarioLlegada && { horarioLlegada: new Date(horarioLlegada) }),
        orden,
      },
    })
    res.json(tramo)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// DELETE lógico /api/tramos/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const tramo = await prisma.tramo.update({
      where: { id: Number(req.params.id) },
      data: { baja: new Date() },
    })
    res.json(tramo)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
