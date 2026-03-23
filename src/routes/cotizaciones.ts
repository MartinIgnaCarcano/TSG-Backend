import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/cotizaciones?viajeId=1
router.get('/', async (req: Request, res: Response) => {
  try {
    const viajeId = req.query.viajeId ? Number(req.query.viajeId) : undefined
    const cotizaciones = await prisma.cotizacion.findMany({
      where: { baja: null, ...(viajeId && { viajeId }) },
      include: { viaje: true },
      orderBy: { alta: 'desc' },
    })
    res.json(cotizaciones)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/cotizaciones/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        viaje: {
          include: {
            tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
          },
        },
      },
    })
    if (!cotizacion) return res.status(404).json({ error: 'Cotización no encontrada' })
    res.json(cotizacion)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/cotizaciones
router.post('/', async (req: Request, res: Response) => {
  try {
    const { aerolinea, precioDolares, precioPesos, cantidadValijas, extra, extraPrecio, clase, viajeId } = req.body
    const cotizacion = await prisma.cotizacion.create({
      data: { aerolinea, precioDolares, precioPesos, cantidadValijas, extra, extraPrecio, clase, viajeId },
    })
    res.status(201).json(cotizacion)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/cotizaciones/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { aerolinea, precioDolares, precioPesos, cantidadValijas, extra, extraPrecio, clase } = req.body
    const cotizacion = await prisma.cotizacion.update({
      where: { id: Number(req.params.id) },
      data: { aerolinea, precioDolares, precioPesos, cantidadValijas, extra, extraPrecio, clase },
    })
    res.json(cotizacion)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// DELETE lógico /api/cotizaciones/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const cotizacion = await prisma.cotizacion.update({
      where: { id: Number(req.params.id) },
      data: { baja: new Date() },
    })
    res.json(cotizacion)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
