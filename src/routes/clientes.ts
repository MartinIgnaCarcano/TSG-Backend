import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/clientes
router.get('/', async (req: Request, res: Response) => {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { baja: null },
      orderBy: { alta: 'desc' },
    })
    res.json(clientes)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/clientes/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        reservas: {
          where: { baja: null },
          include: {
            cotizacionIda: true,
            cotizacionVuelta: true,
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { nombre, apellido, fechaNacimiento, dni, telefono, email, nacionalidad, discapacidad, pasaporte, yaViajo } = req.body
    const cliente = await prisma.cliente.create({
      data: { nombre, apellido, fechaNacimiento: new Date(fechaNacimiento), dni, telefono, email, nacionalidad, discapacidad, pasaporte, yaViajo },
    })
    res.status(201).json(cliente)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/clientes/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { nombre, apellido, fechaNacimiento, dni, telefono, email, nacionalidad, discapacidad, pasaporte, yaViajo } = req.body
    const cliente = await prisma.cliente.update({
      where: { id: Number(req.params.id) },
      data: {
        nombre, apellido,
        ...(fechaNacimiento && { fechaNacimiento: new Date(fechaNacimiento) }),
        dni, telefono, email, nacionalidad, discapacidad, pasaporte, yaViajo,
      },
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
      where: { id: Number(req.params.id) },
      data: { baja: new Date() },
    })
    res.json(cliente)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
