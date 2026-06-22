import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { EstadoReserva, TipoRecordatorio } from '@prisma/client'

const router = Router()

// GET /api/reservas
//   ?clienteId=...
//   ?estado=EN_PROCESO
//   ?vencidas=true   → reservas con saldoPendiente>0 y fechaViaje <= now+7d (usadas por el Flujo 4)
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

    // Agregamos saldoPendiente calculado en la respuesta
    const conSaldo = reservas.map((r) => ({
      ...r,
      saldoPendiente: Number(r.montoFinal) - Number(r.saldoPagado),
    }))

    res.json(conSaldo)
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
    res.json({
      ...reserva,
      saldoPendiente: Number(reserva.montoFinal) - Number(reserva.saldoPagado),
    })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/reservas — crea la reserva Y los recordatorios automáticamente
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      clienteId,
      cotizacionId,
      tipoReserva,
      montoFinal,
      saldoPagado,
      observaciones,
      fechaViaje,    // opcional: si no viene, intentamos sacarla del primer tramo
      fechaRegreso,
    } = req.body
    const numeroReserva = `RES-${Date.now()}`

    // Si no nos pasaron fechaViaje, la inferimos del viaje
    let fViaje = fechaViaje ? new Date(fechaViaje) : undefined
    let fRegreso = fechaRegreso ? new Date(fechaRegreso) : undefined
    if (!fViaje || !fRegreso) {
      const cot = await prisma.cotizacion.findUnique({
        where: { id: cotizacionId },
        include: {
          viaje: { include: { tramos: { orderBy: { orden: 'asc' } } } },
        },
      })
      const tramos = cot?.viaje?.tramos || []
      if (tramos.length > 0 && tramos[0].horaSalida) fViaje = fViaje ?? tramos[0].horaSalida
      if (tramos.length > 0 && tramos[tramos.length - 1].horaLlegada) {
        fRegreso = fRegreso ?? tramos[tramos.length - 1].horaLlegada ?? undefined
      }
    }

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

    // Generar recordatorios automáticamente si tenemos fechaViaje
    if (fViaje) {
      const recordatorios = []
      const dias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

      // PAGO_SALDO: 14 días antes (si hay saldo pendiente)
      const pendiente = Number(montoFinal) - Number(saldoPagado ?? 0)
      if (pendiente > 0) {
        recordatorios.push({
          reservaId: reserva.id,
          tipo: TipoRecordatorio.PAGO_SALDO,
          fechaProgramada: dias(fViaje, -14),
        })
      }

      // CHECK_IN: 1 día antes
      recordatorios.push({
        reservaId: reserva.id,
        tipo: TipoRecordatorio.CHECK_IN,
        fechaProgramada: dias(fViaje, -1),
      })

      // POST_VIAJE: 1 día después del regreso
      if (fRegreso) {
        recordatorios.push({
          reservaId: reserva.id,
          tipo: TipoRecordatorio.POST_VIAJE,
          fechaProgramada: dias(fRegreso, 1),
        })
      }

      if (recordatorios.length > 0) {
        await prisma.recordatorio.createMany({ data: recordatorios })
      }
    }

    res.status(201).json({
      ...reserva,
      saldoPendiente: Number(reserva.montoFinal) - Number(reserva.saldoPagado),
    })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// PUT /api/reservas/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { cotizacionId, tipoReserva, montoFinal, saldoPagado, estado, observaciones, motivoCancelacion } = req.body
    const reserva = await prisma.reserva.update({
      where: { id: req.params.id as string },
      data: { cotizacionId, tipoReserva, montoFinal, saldoPagado, estado, observaciones, motivoCancelacion },
    })
    // Si el saldo cubre el total, cerrar recordatorios de PAGO_SALDO
    const mFinal = Number(reserva.montoFinal)
    const mPagado = Number(reserva.saldoPagado)
    if (mFinal > 0 && mPagado >= mFinal) {
      await prisma.recordatorio.updateMany({
        where: { reservaId: req.params.id as string, tipo: TipoRecordatorio.PAGO_SALDO, ejecutado: false },
        data: { ejecutado: true, fechaEjecucion: new Date(), resultado: 'Saldo cancelado — marcado automáticamente al registrar pago total' },
      })
    }
    res.json({
      ...reserva,
      saldoPendiente: Number(reserva.montoFinal) - Number(reserva.saldoPagado),
    })
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

// PATCH /api/reservas/:id/cancelar  ← usado por el Flujo 4
router.patch('/:id/cancelar', async (req: Request, res: Response) => {
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
router.patch('/:id/pago', async (req: Request, res: Response) => {
  try {
    const { monto } = req.body
    if (!monto || monto <= 0) return res.status(400).json({ error: 'monto debe ser > 0' })

    const id = req.params.id as string;
    if (!id) return res.status(400).json({ error: 'ID requerido' });

    const actual = await prisma.reserva.findUnique({ where: { id } });
    if (!actual) return res.status(404).json({ error: 'Reserva no encontrada' });
    const nuevoSaldo = Number(actual.saldoPagado) + Number(monto)
    const pagadoTotal = nuevoSaldo >= Number(actual.montoFinal)
    const reserva = await prisma.reserva.update({
      where: { id: req.params.id as string },
      data: { saldoPagado: nuevoSaldo },
    })
    // Si el pago cubre el total, cerrar los recordatorios de PAGO_SALDO
    if (pagadoTotal) {
      await prisma.recordatorio.updateMany({
        where: { reservaId: id, tipo: TipoRecordatorio.PAGO_SALDO, ejecutado: false },
        data: { ejecutado: true, fechaEjecucion: new Date(), resultado: 'Saldo cancelado — marcado automáticamente al registrar pago total' },
      })
    }
    res.json({
      ...reserva,
      saldoPendiente: Number(reserva.montoFinal) - Number(reserva.saldoPagado),
    })
  } catch (e: any) {
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
