import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { validateBody } from '../middleware/validate'
import { crearCotizacionSchema, actualizarCotizacionSchema } from '../schemas/cotizacion.schema'
import { parsePaginacion } from '../lib/pagination'

const router = Router()

// GET /api/cotizaciones
//   ?viajeId=...
//   ?estado=PENDIENTE
//   ?vigentes=true   → solo PENDIENTE/ENVIADA, no vencidas (usado por Flujo 2 Smart Pricing)
//   ?page&?pageSize  → opcional; sin esto, devuelve array plano (compat n8n/front)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const viajeId = req.query.viajeId as string | undefined
    const estado = req.query.estado as string | undefined
    const vigentes = req.query.vigentes === 'true'

    const where: any = { baja: null }
    if (viajeId) where.viajeId = viajeId
    if (estado) where.estado = estado
    if (vigentes) {
      where.estado = { in: ['PENDIENTE', 'ENVIADA'] }
      where.fechaVencimiento = { gt: new Date() }
    }

    const include = {
      viaje: { include: { origen: true, destino: true, tramos: { where: { baja: null }, orderBy: { orden: 'asc' } } } },
      cliente: true,
      hotel: true,
    } as any

    const paginacion = parsePaginacion(req.query as Record<string, unknown>)

    if (!paginacion) {
      const cotizaciones = await prisma.cotizacion.findMany({ where, include, orderBy: { alta: 'desc' } })
      return res.json(cotizaciones)
    }

    const [cotizaciones, total] = await Promise.all([
      prisma.cotizacion.findMany({ where, include, orderBy: { alta: 'desc' }, skip: paginacion.skip, take: paginacion.take }),
      prisma.cotizacion.count({ where }),
    ])

    res.json({
      data: cotizaciones,
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
      totalPages: Math.ceil(total / paginacion.pageSize),
    })
  } catch (e) {
    next(e)
  }
})

// GET /api/cotizaciones/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
        hotel: true,
      } as any,
    })
    if (!cotizacion) return res.status(404).json({ error: 'Cotización no encontrada' })
    res.json(cotizacion)
  } catch (e) {
    next(e)
  }
})

// POST /api/cotizaciones
router.post('/', validateBody(crearCotizacionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { viajeId, clienteId, fechaVencimiento, moneda, precioIda, precioVuelta, precioIdaYVuelta, impuestos, observaciones, ofertaExternaID, clase, cantidadValijas, extras, precioExtras } = req.body
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
        // Producto aéreo (usa defaults del schema si no vienen)
        ...(clase !== undefined && { clase }),
        ...(cantidadValijas !== undefined && { cantidadValijas }),
        ...(extras !== undefined && { extras: extras || null }),
        ...(precioExtras !== undefined && { precioExtras: precioExtras ?? null }),
      },
    })
    res.status(201).json(cotizacion)
  } catch (e) {
    next(e)
  }
})

// PUT /api/cotizaciones/:id
router.put('/:id', validateBody(actualizarCotizacionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fechaVencimiento, moneda, precioIda, precioVuelta, precioIdaYVuelta, impuestos, observaciones, estado, ofertaExternaID, hotelId, noches, precioHotel, clase, cantidadValijas, extras, precioExtras } = req.body
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
        // Hotel opcional
        ...(hotelId !== undefined && { hotelId: hotelId || null }),
        ...(noches !== undefined && { noches: noches || null }),
        ...(precioHotel !== undefined && { precioHotel: precioHotel || null }),
        // Producto aéreo
        ...(clase !== undefined && { clase }),
        ...(cantidadValijas !== undefined && { cantidadValijas }),
        ...(extras !== undefined && { extras: extras || null }),
        ...(precioExtras !== undefined && { precioExtras: precioExtras ?? null }),
      },
      include: { hotel: true } as any,
    })
    res.json(cotizacion)
  } catch (e) {
    next(e)
  }
})

// DELETE lógico /api/cotizaciones/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cotizacion = await prisma.cotizacion.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(cotizacion)
  } catch (e) {
    next(e)
  }
})

export default router
