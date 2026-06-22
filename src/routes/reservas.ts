import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { EstadoReserva } from '@prisma/client'
import { validateBody } from '../middleware/validate'
import {
  crearReservaSchema,
  actualizarReservaSchema,
  registrarPagoSchema,
  cancelarReservaSchema,
} from '../schemas/reserva.schema'
import {
  conSaldoPendiente,
  inferirFechasViaje,
  construirRecordatorios,
  cerrarRecordatoriosSiCorresponde,
} from '../services/reservas.service'
import { parsePaginacion, paginarArray } from '../lib/pagination'

const router = Router()

// GET /api/reservas
//   ?clienteId=...
//   ?estado=EN_PROCESO
//   ?vencidas=true   → reservas con saldoPendiente>0 y fechaViaje <= now+7d (usadas por el Flujo 4)
//   ?page&?pageSize  → opcional; sin esto, devuelve array plano (compat n8n/front)
router.get('/', async (req: Request, res: Response) => {
  try {
    const clienteId = req.query.clienteId as string | undefined
    const estado = req.query.estado as EstadoReserva | undefined
    const vencidas = req.query.vencidas === 'true'

    let where: any = { baja: null }
    if (clienteId) where.clienteId = clienteId
    if (estado) where.estado = estado

    let reservas = await prisma.reserva.findMany({
      where,
      include: {
        cliente: true,
        cotizacion: {
          include: {
            viaje: {
              include: {
                origen: true,
                destino: true,
                tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
              },
            },
          },
        },
      },
      orderBy: { alta: 'desc' },
    })

    // Filtro "vencidas" se hace en JS porque saldoPendiente es calculado
    if (vencidas) {
      const limite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      reservas = reservas.filter((r) => {
        if (r.estado === 'CANCELADA') return false
        const pendiente = Number(r.montoFinal) - Number(r.saldoPagado)
        if (pendiente <= 0) return false
        if (!r.fechaViaje) return false
        return new Date(r.fechaViaje) <= limite
      })
    }

    const conSaldo = reservas.map(conSaldoPendiente)

    const paginacion = parsePaginacion(req.query as Record<string, unknown>)
    if (!paginacion) return res.json(conSaldo)

    res.json(paginarArray(conSaldo, paginacion))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

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
                origen: true,
                destino: true,
                tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
              },
            },
          },
        },
        recordatorios: { orderBy: { fechaProgramada: 'asc' } },
      },
    })
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })
    res.json(conSaldoPendiente(reserva))
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/reservas — crea la reserva Y los recordatorios automáticamente
router.post('/', validateBody(crearReservaSchema), async (req: Request, res: Response) => {
  try {
    const {
      clienteId,
      cotizacionId,
      tipoReserva,
      montoFinal,
      saldoPagado,
      observaciones,
      fechaViaje,    // opcional: si no viene, se infiere del primer/último tramo
      fechaRegreso,
    } = req.body
    const numeroReserva = `RES-${Date.now()}`

    const { fViaje, fRegreso } = await inferirFechasViaje(cotizacionId, fechaViaje, fechaRegreso)

    const reserva = await prisma.reserva.create({
      data: {
        clienteId,
        cotizacionId,
        tipoReserva,
        montoFinal,
        saldoPagado: saldoPagado ?? 0,
        numeroReserva,
        observaciones,
        fechaViaje: fViaje,
        fechaRegreso: fRegreso,
      },
      include: { cliente: true, cotizacion: true },
    })

    const recordatorios = construirRecordatorios(reserva.id, montoFinal, saldoPagado ?? 0, fViaje, fRegreso)
    if (recordatorios.length > 0) {
      await prisma.recordatorio.createMany({ data: recordatorios })
    }

    res.status(201).json(conSaldoPendiente(reserva))
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/reservas/:id
router.put('/:id', validateBody(actualizarReservaSchema), async (req: Request, res: Response) => {
  try {
    const { cotizacionId, tipoReserva, montoFinal, saldoPagado, estado, observaciones, motivoCancelacion } = req.body
    const id = req.params.id as string

    const reserva = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.reserva.update({
        where: { id },
        data: { cotizacionId, tipoReserva, montoFinal, saldoPagado, estado, observaciones, motivoCancelacion },
      })
      await cerrarRecordatoriosSiCorresponde(tx, id, actualizada.montoFinal, actualizada.saldoPagado)
      return actualizada
    })

    res.json(conSaldoPendiente(reserva))
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Reserva no encontrada' })
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

// PATCH /api/reservas/:id/cancelar  ← usado por el Flujo 4
router.patch('/:id/cancelar', validateBody(cancelarReservaSchema), async (req: Request, res: Response) => {
  try {
    const { motivo } = req.body
    const reserva = await prisma.reserva.update({
      where: { id: req.params.id as string },
      data: {
        estado: EstadoReserva.CANCELADA,
        motivoCancelacion: motivo || 'Cancelada automáticamente por vencimiento',
      },
    })
    res.json(reserva)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PATCH /api/reservas/:id/pago — registra un pago parcial o total
//
// Atómico: usamos `increment` de Prisma, que se traduce en un único
// UPDATE ... SET saldo_pagado = saldo_pagado + $monto a nivel SQL. Antes
// se leía saldoPagado, se sumaba en JS y se escribía el valor absoluto:
// si dos pagos llegaban casi al mismo tiempo (ej. dos webhooks de n8n
// reintentando), ambos podían leer el mismo saldo viejo y el segundo
// UPDATE pisaba al primero, perdiendo un pago. Con `increment` cada
// request suma sobre el valor real en la base, no sobre una copia leída
// en memoria — no importa el orden ni la concurrencia.
router.patch('/:id/pago', validateBody(registrarPagoSchema), async (req: Request, res: Response) => {
  try {
    const { monto } = req.body
    const id = req.params.id as string
    if (!id) return res.status(400).json({ error: 'ID requerido' })

    const reserva = await prisma.$transaction(async (tx) => {
      const actualizada = await tx.reserva.update({
        where: { id },
        data: { saldoPagado: { increment: monto } },
      })
      await cerrarRecordatoriosSiCorresponde(tx, id, actualizada.montoFinal, actualizada.saldoPagado)
      return actualizada
    })

    res.json(conSaldoPendiente(reserva))
  } catch (e: any) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Reserva no encontrada' })
    res.status(400).json({ error: e.message })
  }
})

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
