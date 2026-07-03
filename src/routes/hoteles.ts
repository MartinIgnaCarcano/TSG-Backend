// =====================================================
// /api/hoteles — CRUD del catálogo de hoteles
// Usado por el panel admin y por el Flujo 6 (buscar hoteles)
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/hoteles
//   ?destinoId=...        → filtra por destino
//   ?destinoIATA=MAD      → filtra por IATA
//   ?estrellas=4          → filtra por estrellas
//   ?max=100              → precio máx por noche
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destinoId = req.query.destinoId as string | undefined
    const destinoIATA = (req.query.destinoIATA as string | undefined)?.toUpperCase()
    const estrellas = req.query.estrellas ? parseInt(req.query.estrellas as string) : undefined
    const max = req.query.max ? parseFloat(req.query.max as string) : undefined

    const where: any = { baja: null }
    if (destinoId) where.destinoId = destinoId
    if (estrellas) where.estrellas = estrellas

    // Si vino IATA, lo resolvemos al destinoId
    if (destinoIATA && !destinoId) {
      const dest = await prisma.destino.findUnique({ where: { codigoIATA: destinoIATA } })
      if (!dest) return res.json([])
      where.destinoId = dest.id
    }

    let hoteles = await prisma.hotel.findMany({
      where,
      include: { destino: true },
      orderBy: [{ estrellas: 'desc' }, { precioNoche: 'asc' }],
    })

    if (max) hoteles = hoteles.filter((h) => Number(h.precioNoche) <= max)
    res.json(hoteles)
  } catch (e) {
    next(e)
  }
})

// GET /api/hoteles/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hotel = await prisma.hotel.findUnique({
      where: { id: req.params.id as string },
      include: { destino: true },
    })
    if (!hotel) return res.status(404).json({ error: 'Hotel no encontrado' })
    res.json(hotel)
  } catch (e) {
    next(e)
  }
})

// POST /api/hoteles
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      nombre, destinoId, destinoIATA,
      estrellas, precioNoche, moneda,
      descripcion, direccion, urlImagen, urlReserva,
      fuente, rating,
    } = req.body

    if (!nombre) return res.status(400).json({ error: 'Falta nombre' })
    if (precioNoche == null) return res.status(400).json({ error: 'Falta precioNoche' })

    // Resolver destinoId desde IATA si viene
    let dId = destinoId
    if (!dId && destinoIATA) {
      const d = await prisma.destino.findUnique({ where: { codigoIATA: String(destinoIATA).toUpperCase() } })
      if (!d) return res.status(400).json({ error: `Destino IATA ${destinoIATA} no existe` })
      dId = d.id
    }
    if (!dId) return res.status(400).json({ error: 'Falta destinoId o destinoIATA' })

    const hotel = await prisma.hotel.create({
      data: {
        nombre,
        destinoId: dId,
        estrellas: estrellas ?? 3,
        precioNoche,
        moneda: moneda || 'USD',
        descripcion,
        direccion,
        urlImagen,
        urlReserva,
        fuente: fuente || 'MANUAL',
        rating: rating != null ? rating : undefined,
      },
      include: { destino: true },
    })
    res.status(201).json(hotel)
  } catch (e) {
    next(e)
  }
})

// PUT /api/hoteles/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      nombre, destinoId, destinoIATA,
      estrellas, precioNoche, moneda,
      descripcion, direccion, urlImagen, urlReserva,
      fuente, rating,
    } = req.body

    let dId = destinoId
    if (!dId && destinoIATA) {
      const d = await prisma.destino.findUnique({ where: { codigoIATA: String(destinoIATA).toUpperCase() } })
      if (d) dId = d.id
    }

    const hotel = await prisma.hotel.update({
      where: { id: req.params.id as string },
      data: {
        nombre,
        ...(dId && { destinoId: dId }),
        estrellas,
        precioNoche,
        moneda,
        descripcion,
        direccion,
        urlImagen,
        urlReserva,
        fuente,
        rating,
      },
      include: { destino: true },
    })
    res.json(hotel)
  } catch (e) {
    next(e)
  }
})

// DELETE lógico /api/hoteles/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hotel = await prisma.hotel.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(hotel)
  } catch (e) {
    next(e)
  }
})

// POST /api/hoteles/bulk — usado por el Flujo 6, recibe array y hace upsert por (nombre + destinoId)
router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items: any[] = Array.isArray(req.body) ? req.body : (req.body.items || [])
    if (!items.length) return res.status(400).json({ error: 'Array vacío' })

    let creados = 0, actualizados = 0
    for (const item of items) {
      // Resolver destino IATA si viene
      let dId = item.destinoId
      if (!dId && item.destinoIATA) {
        const d = await prisma.destino.findUnique({
          where: { codigoIATA: String(item.destinoIATA).toUpperCase() },
        })
        if (d) dId = d.id
      }
      if (!dId || !item.nombre) continue

      const existente = await prisma.hotel.findFirst({
        where: { nombre: item.nombre, destinoId: dId, baja: null },
      })

      if (existente) {
        await prisma.hotel.update({
          where: { id: existente.id },
          data: {
            estrellas: item.estrellas ?? existente.estrellas,
            precioNoche: item.precioNoche ?? existente.precioNoche,
            urlImagen: item.urlImagen ?? existente.urlImagen,
            urlReserva: item.urlReserva ?? existente.urlReserva,
            descripcion: item.descripcion ?? existente.descripcion,
            rating: item.rating ?? existente.rating,
            fuente: item.fuente || existente.fuente,
          },
        })
        actualizados++
      } else {
        await prisma.hotel.create({
          data: {
            nombre: item.nombre,
            destinoId: dId,
            estrellas: item.estrellas ?? 3,
            precioNoche: item.precioNoche ?? 0,
            moneda: item.moneda || 'USD',
            descripcion: item.descripcion,
            direccion: item.direccion,
            urlImagen: item.urlImagen,
            urlReserva: item.urlReserva,
            rating: item.rating,
            fuente: item.fuente || 'RAPIDAPI',
          },
        })
        creados++
      }
    }
    res.json({ ok: true, creados, actualizados, total: items.length })
  } catch (e) {
    next(e)
  }
})

export default router
