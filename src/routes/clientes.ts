import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { validateBody } from '../middleware/validate'
import { crearClienteSchema, actualizarClienteSchema } from '../schemas/cliente.schema'
import { parsePaginacion } from '../lib/pagination'

const router = Router()

// GET /api/clientes
// Sin ?page/?pageSize → array plano (compat con front/n8n actuales).
// Con ?page/?pageSize → { data, page, pageSize, total, totalPages }.
router.get('/', async (req: Request, res: Response) => {
  try {
    const paginacion = parsePaginacion(req.query as Record<string, unknown>)

    if (!paginacion) {
      const clientes = await prisma.cliente.findMany({
        where: { baja: null },
        orderBy: { alta: 'desc' },
      })
      return res.json(clientes)
    }

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where: { baja: null },
        orderBy: { alta: 'desc' },
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      prisma.cliente.count({ where: { baja: null } }),
    ])

    res.json({
      data: clientes,
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
      totalPages: Math.ceil(total / paginacion.pageSize),
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/clientes/:id
router.get('/:id', async (req: Request, res: Response) => {
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
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/clientes
router.post('/', validateBody(crearClienteSchema), async (req: Request, res: Response) => {
  try {
    const { nombre, apellido, telefono, email } = req.body
    const numeroCliente = `CLI-${Date.now()}`
    const cliente = await prisma.cliente.create({
      data: { nombre, apellido, telefono, email, numeroCliente },
    })
    res.status(201).json(cliente)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/clientes/:id
router.put('/:id', validateBody(actualizarClienteSchema), async (req: Request, res: Response) => {
  try {
    const { nombre, apellido, telefono, email } = req.body
    const cliente = await prisma.cliente.update({
      where: { id: req.params.id as string },
      data: { nombre, apellido, telefono, email },
    })
    res.json(cliente)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// DELETE lógico /api/clientes/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const cliente = await prisma.cliente.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(cliente)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router

