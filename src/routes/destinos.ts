import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/destinos              → lista todos los activos
// GET /api/destinos?iata=EZE     → busca por código IATA exacto
// GET /api/destinos?q=mendoza    → busca por nombre (contains, case-insensitive)
//                                  o por IATA si la query tiene 3 letras. Devuelve hasta 5.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const iata = (req.query.iata as string | undefined)?.toUpperCase()
    const q = (req.query.q as string | undefined)?.trim()

    // Caso 1: filtro por IATA exacto
    if (iata) {
      const destinos = await prisma.destino.findMany({
        where: { baja: null, codigoIATA: iata },
      })
      return res.json(destinos)
    }

    // Caso 2: query libre — si tiene 3 letras probamos IATA exacto primero
    if (q) {
      if (/^[A-Za-z]{3}$/.test(q)) {
        const porIata = await prisma.destino.findFirst({
          where: { baja: null, codigoIATA: q.toUpperCase() },
        })
        if (porIata) return res.json([porIata])
      }
      const destinos = await prisma.destino.findMany({
        where: {
          baja: null,
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { codigoIATA: { contains: q.toUpperCase() } },
          ],
        },
        orderBy: { nombre: 'asc' },
        take: 5,
      })
      return res.json(destinos)
    }

    // Caso 3: listado completo
    const destinos = await prisma.destino.findMany({
      where: { baja: null },
      orderBy: { nombre: 'asc' },
    })
    res.json(destinos)
  } catch (e) {
    next(e)
  }
})

// GET /api/destinos/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destino = await prisma.destino.findUnique({
      where: { id: req.params.id as string },
    })
    if (!destino) return res.status(404).json({ error: 'Destino no encontrado' })
    res.json(destino)
  } catch (e) {
    next(e)
  }
})

// POST /api/destinos
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, codigoIATA, pais, timezone } = req.body
    const destino = await prisma.destino.create({
      data: {
        nombre,
        codigoIATA: String(codigoIATA).toUpperCase(),
        pais,
        timezone: timezone || 'UTC',
      },
    })
    res.status(201).json(destino)
  } catch (e) {
    next(e)
  }
})

// PUT /api/destinos/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, codigoIATA, pais, timezone } = req.body
    const destino = await prisma.destino.update({
      where: { id: req.params.id as string },
      data: {
        nombre,
        ...(codigoIATA && { codigoIATA: String(codigoIATA).toUpperCase() }),
        pais,
        timezone,
      },
    })
    res.json(destino)
  } catch (e) {
    next(e)
  }
})

// DELETE lógico /api/destinos/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destino = await prisma.destino.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(destino)
  } catch (e) {
    next(e)
  }
})

export default router

