import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/viajes
router.get('/', async (req: Request, res: Response) => {
  try {
    const viajes = await prisma.viaje.findMany({
      where: { baja: null },
      include: {
        origen: true,
        destino: true,
        tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
        cotizaciones: { where: { baja: null } },
      },
      orderBy: { alta: 'asc' },
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
      where: { id: req.params.id as string },
      include: {
        origen: true,
        destino: true,
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

// POST /api/viajes
router.post('/', async (req: Request, res: Response) => {
  try {
    const { origenId, destinoId, tieneEscalas, descripcion, tramos } = req.body
    const viaje = await prisma.viaje.create({
      data: {
        origenId,
        destinoId,
        tieneEscalas,
        descripcion,
        tramos: tramos
          ? {
              create: tramos.map((t: any) => ({
                origenId: t.origenId,
                destinoId: t.destinoId,
                orden: t.orden,
                duracionMinutos: t.duracionMinutos,
                horaSalida: t.horaSalida ? new Date(t.horaSalida) : undefined,
                horaLlegada: t.horaLlegada ? new Date(t.horaLlegada) : undefined,
                aerolinea: t.aerolinea,
                completo: t.completo ?? false,
              })),
            }
          : undefined,
      },
      include: {
        origen: true,
        destino: true,
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
    const { origenId, destinoId, tieneEscalas, descripcion } = req.body
    const viaje = await prisma.viaje.update({
      where: { id: req.params.id as string },
      data: { origenId, destinoId, tieneEscalas, descripcion },
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
        where: { viajeId: req.params.id as string },
        data: { baja: new Date() },
      }),
      prisma.cotizacion.updateMany({
        where: { viajeId: req.params.id as string },
        data: { baja: new Date() },
      }),
      prisma.viaje.update({
        where: { id: req.params.id as string },
        data: { baja: new Date() },
      }),
    ])
    res.json(viaje)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
