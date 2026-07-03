import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { validateBody } from '../middleware/validate'
import { crearClienteSchema, actualizarClienteSchema } from '../schemas/cliente.schema'
import { parsePaginacion } from '../lib/pagination'

const router = Router()

// GET /api/clientes
// Sin ?page/?pageSize → array plano (compat con front/n8n actuales).
// Con ?page/?pageSize → { data, page, pageSize, total, totalPages }.
// ?email= → filtro server-side exacto (case-insensitive); usado por el bot para no bajar toda la tabla (Fase S7).
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paginacion = parsePaginacion(req.query as Record<string, unknown>)
    const emailFiltro = typeof req.query.email === 'string' ? req.query.email.trim() : undefined

    const where = {
      baja: null,
      ...(emailFiltro
        ? { email: { equals: emailFiltro, mode: 'insensitive' as const } }
        : {}),
    }

    if (!paginacion) {
      const clientes = await prisma.cliente.findMany({
        where,
        orderBy: { alta: 'desc' },
      })
      return res.json(clientes)
    }

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: { alta: 'desc' },
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      prisma.cliente.count({ where }),
    ])

    res.json({
      data: clientes,
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
      totalPages: Math.ceil(total / paginacion.pageSize),
    })
  } catch (e) {
    next(e)
  }
})

// GET /api/clientes/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: req.params.id as string },
      include: {
        reservas: {
          where: { baja: null },
          include: {
            cotizacion: true,
          },
        },
      },
    })
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' })
    res.json(cliente)
  } catch (e) {
    next(e)
  }
})

// POST /api/clientes
router.post('/', validateBody(crearClienteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, apellido, telefono, email } = req.body
    const numeroCliente = `CLI-${Date.now()}`
    const cliente = await prisma.cliente.create({
      data: { nombre, apellido, telefono, email, numeroCliente },
    })
    res.status(201).json(cliente)
  } catch (e) {
    next(e)
  }
})

// PUT /api/clientes/:id
router.put('/:id', validateBody(actualizarClienteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, apellido, telefono, email } = req.body
    const cliente = await prisma.cliente.update({
      where: { id: req.params.id as string },
      data: { nombre, apellido, telefono, email },
    })
    res.json(cliente)
  } catch (e) {
    next(e)
  }
})

// DELETE lógico /api/clientes/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cliente = await prisma.cliente.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(cliente)
  } catch (e) {
    next(e)
  }
})

export default router

