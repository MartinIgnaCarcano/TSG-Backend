import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/cotizaciones?viajeId=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const viajeId = req.query.viajeId as string | undefined
    const cotizaciones = await prisma.cotizacion.findMany({
      where: { baja: null, ...(viajeId && { viajeId }) },
      include: { viaje: true, cliente: true },
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
      where: { id: req.params.id as string },
      include: {
        viaje: {
          include: {
            tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
          },
        },
        cliente: true,
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
    const { viajeId, clienteId, fechaVencimiento, moneda, precioIda, precioVuelta, precioIdaYVuelta, impuestos, observaciones, ofertaExternaID } = req.body
    const numeroCotizacion = `COT-${Date.now()}`
    const cotizacion = await prisma.cotizacion.create({
      data: {
        viajeId,
        clienteId,
        numeroCotizacion,
        fechaVencimiento: new Date(fechaVencimiento),
        moneda,
        precioIda,
        precioVuelta,
        precioIdaYVuelta,
        impuestos,
        observaciones,
        ofertaExternaID,
      },
    })
    res.status(201).json(cotizacion)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/cotizaciones/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { fechaVencimiento, moneda, precioIda, precioVuelta, precioIdaYVuelta, impuestos, observaciones, estado, ofertaExternaID } = req.body
    const cotizacion = await prisma.cotizacion.update({
      where: { id: req.params.id as string },
      data: {
        ...(fechaVencimiento && { fechaVencimiento: new Date(fechaVencimiento) }),
        moneda,
        precioIda,
        precioVuelta,
        precioIdaYVuelta,
        impuestos,
        observaciones,
        estado,
        ofertaExternaID,
      },
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
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(cotizacion)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
