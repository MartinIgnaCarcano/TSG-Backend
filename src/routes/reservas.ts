import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { EstadoReserva } from '@prisma/client'

const router = Router()

// GET /api/reservas?clienteId=...&estado=EN_PROCESO
router.get('/', async (req: Request, res: Response) => {
  try {
    const clienteId = req.query.clienteId as string | undefined
    const estado = req.query.estado as EstadoReserva | undefined

    const reservas = await prisma.reserva.findMany({
      where: {
        baja: null,
        ...(clienteId && { clienteId }),
        ...(estado && { estado }),
      },
      include: {
        cliente: true,
        cotizacion: {
          include: {
            viaje: {
              include: {
                tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
              },
            },
          },
        },
      },
      orderBy: { alta: 'desc' },
    })
    res.json(reservas)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/reservas/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const reserva = await prisma.reserva.findUnique({
      where: { id: req.params.id as string },
      include: {
        cliente: true,
        cotizacion: {
          include: {
            viaje: {
              include: {
                tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
              },
            },
          },
        },
      },
    })
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })
    res.json(reserva)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/reservas
router.post('/', async (req: Request, res: Response) => {
  try {
    const { clienteId, cotizacionId, tipoReserva, montoFinal, observaciones } = req.body
    const numeroReserva = `RES-${Date.now()}`
    const reserva = await prisma.reserva.create({
      data: { clienteId, cotizacionId, tipoReserva, montoFinal, numeroReserva, observaciones },
      include: {
        cliente: true,
        cotizacion: true,
      },
    })
    res.status(201).json(reserva)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/reservas/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { cotizacionId, tipoReserva, montoFinal, estado, observaciones } = req.body
    const reserva = await prisma.reserva.update({
      where: { id: req.params.id as string },
      data: { cotizacionId, tipoReserva, montoFinal, estado, observaciones },
    })
    res.json(reserva)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PATCH /api/reservas/:id/confirmar
router.patch('/:id/confirmar', async (req: Request, res: Response) => {
  try {
    const reserva = await prisma.reserva.update({
      where: { id: req.params.id as string },
      data: { estado: EstadoReserva.CONFIRMADA },
    })
    res.json(reserva)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// DELETE lógico /api/reservas/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const reserva = await prisma.reserva.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(reserva)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
