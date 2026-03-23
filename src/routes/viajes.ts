import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/viajes
router.get('/', async (req: Request, res: Response) => {
  try {
    const viajes = await prisma.viaje.findMany({
      where: { baja: null },
      include: {
        tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
        cotizaciones: { where: { baja: null } },
      },
      orderBy: { fechaSalida: 'asc' },
    })
    res.json(viajes)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/viajes/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const viaje = await prisma.viaje.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
        cotizaciones: { where: { baja: null } },
      },
    })
    if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' })
    res.json(viaje)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/viajes  (crea el viaje con sus tramos en una sola operación)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { lugarSalida, lugarLlegada, fechaSalida, fechaLlegada, tramos } = req.body
    const viaje = await prisma.viaje.create({
      data: {
        lugarSalida,
        lugarLlegada,
        fechaSalida: new Date(fechaSalida),
        fechaLlegada: new Date(fechaLlegada),
        tramos: tramos
          ? {
              create: tramos.map((t: any) => ({
                aeropuertoSalida: t.aeropuertoSalida,
                horarioSalida: new Date(t.horarioSalida),
                aeropuertoLlegada: t.aeropuertoLlegada,
                horarioLlegada: new Date(t.horarioLlegada),
                orden: t.orden,
              })),
            }
          : undefined,
      },
      include: {
        tramos: { orderBy: { orden: 'asc' } },
      },
    })
    res.status(201).json(viaje)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/viajes/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { lugarSalida, lugarLlegada, fechaSalida, fechaLlegada } = req.body
    const viaje = await prisma.viaje.update({
      where: { id: Number(req.params.id) },
      data: {
        lugarSalida,
        lugarLlegada,
        ...(fechaSalida && { fechaSalida: new Date(fechaSalida) }),
        ...(fechaLlegada && { fechaLlegada: new Date(fechaLlegada) }),
      },
    })
    res.json(viaje)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// DELETE lógico /api/viajes/:id  (baja también los tramos y cotizaciones)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [, , viaje] = await prisma.$transaction([
      prisma.tramo.updateMany({
        where: { viajeId: Number(req.params.id) },
        data: { baja: new Date() },
      }),
      prisma.cotizacion.updateMany({
        where: { viajeId: Number(req.params.id) },
        data: { baja: new Date() },
      }),
      prisma.viaje.update({
        where: { id: Number(req.params.id) },
        data: { baja: new Date() },
      }),
    ])
    res.json(viaje)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
