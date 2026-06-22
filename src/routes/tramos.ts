import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/tramos?viajeId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const viajeId = req.query.viajeId as string | undefined
    const tramos = await prisma.tramo.findMany({
      where: { baja: null, ...(viajeId && { viajeId }) },
      include: { origen: true, destino: true },
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
      where: { id: req.params.id as string },
      include: { viaje: true, origen: true, destino: true },
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
    const { origenId, destinoId, orden, duracionMinutos, horaSalida, horaLlegada, aerolinea, completo, viajeId } = req.body
    const tramo = await prisma.tramo.create({
      data: {
        origenId,
        destinoId,
        orden,
        duracionMinutos,
        horaSalida: horaSalida ? new Date(horaSalida) : undefined,
        horaLlegada: horaLlegada ? new Date(horaLlegada) : undefined,
        aerolinea,
        completo: completo ?? false,
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
    const { origenId, destinoId, orden, duracionMinutos, horaSalida, horaLlegada, aerolinea, completo } = req.body
    const tramo = await prisma.tramo.update({
      where: { id: req.params.id as string },
      data: {
        origenId,
        destinoId,
        orden,
        duracionMinutos,
        ...(horaSalida && { horaSalida: new Date(horaSalida) }),
        ...(horaLlegada && { horaLlegada: new Date(horaLlegada) }),
        aerolinea,
        completo,
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
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(tramo)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router

