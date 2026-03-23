import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/reservas?clienteId=1&finalizado=false
router.get('/', async (req: Request, res: Response) => {
  try {
    const clienteId = req.query.clienteId ? Number(req.query.clienteId) : undefined
    const finalizado = req.query.finalizado !== undefined ? req.query.finalizado === 'true' : undefined

    const reservas = await prisma.reserva.findMany({
      where: {
        baja: null,
        ...(clienteId && { clienteId }),
        ...(finalizado !== undefined && { finalizado }),
      },
      include: {
        cliente: true,
        cotizacionIda: { include: { viaje: { include: { tramos: { where: { baja: null }, orderBy: { orden: 'asc' } } } } } },
        cotizacionVuelta: { include: { viaje: { include: { tramos: { where: { baja: null }, orderBy: { orden: 'asc' } } } } } },
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
      where: { id: Number(req.params.id) },
      include: {
        cliente: true,
        cotizacionIda: { include: { viaje: { include: { tramos: { where: { baja: null }, orderBy: { orden: 'asc' } } } } } },
        cotizacionVuelta: { include: { viaje: { include: { tramos: { where: { baja: null }, orderBy: { orden: 'asc' } } } } } },
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
    const { clienteId, cotizacionIdaId, cotizacionVueltaId, saldoCliente, saldoVendedor } = req.body
    const reserva = await prisma.reserva.create({
      data: { clienteId, cotizacionIdaId, cotizacionVueltaId, saldoCliente, saldoVendedor },
      include: {
        cliente: true,
        cotizacionIda: true,
        cotizacionVuelta: true,
      },
    })

    // Marcar al cliente como que ya viajó si la reserva está finalizada
    await prisma.cliente.update({
      where: { id: clienteId },
      data: { yaViajo: true },
    })

    res.status(201).json(reserva)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/reservas/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { cotizacionIdaId, cotizacionVueltaId, saldoCliente, saldoVendedor, finalizado } = req.body
    const reserva = await prisma.reserva.update({
      where: { id: Number(req.params.id) },
      data: { cotizacionIdaId, cotizacionVueltaId, saldoCliente, saldoVendedor, finalizado },
    })
    res.json(reserva)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PATCH /api/reservas/:id/finalizar
router.patch('/:id/finalizar', async (req: Request, res: Response) => {
  try {
    const reserva = await prisma.reserva.update({
      where: { id: Number(req.params.id) },
      data: { finalizado: true },
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
      where: { id: Number(req.params.id) },
      data: { baja: new Date() },
    })
    res.json(reserva)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router
