// =====================================================
// Fase D — Pago. Alta directa de un pago con detalle de medio/referencia,
// sin pasar por la ruta anidada de reservas. Reutiliza registrarPago()
// para no duplicar la lógica de incrementar saldoPagado / cerrar
// recordatorios / avanzar a PAGADA.
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { validateBody } from '../middleware/validate'
import { crearPagoSchema } from '../schemas/pago.schema'
import { registrarPago, anularPago } from '../services/reservas.service'

const router = Router()

// GET /api/pagos?reservaId=...
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservaId = req.query.reservaId as string | undefined
    const pagos = await prisma.pago.findMany({
      where: { baja: null, ...(reservaId && { reservaId }) },
      orderBy: { fechaPago: 'desc' },
    })
    res.json(pagos)
  } catch (e) {
    next(e)
  }
})

// GET /api/pagos/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pago = await prisma.pago.findUnique({ where: { id: req.params.id as string } })
    if (!pago) return res.status(404).json({ error: 'Pago no encontrado' })
    res.json(pago)
  } catch (e) {
    next(e)
  }
})

// POST /api/pagos — crea el Pago Y concilia la reserva (saldoPagado, recordatorios, estado)
router.post('/', validateBody(crearPagoSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservaId, monto, medioPago, referencia, observaciones, fechaPago } = req.body
    const { pago, reserva } = await prisma.$transaction((tx) =>
      registrarPago(tx, reservaId, { monto, medioPago, referencia, observaciones, fechaPago }),
    )
    res.status(201).json({ pago, reserva })
  } catch (e) {
    next(e)
  }
})

// DELETE lógico /api/pagos/:id — anula un pago mal registrado Y concilia
// la reserva en la misma transacción (Fase S5): recalcula saldoPagado
// como SUM de los pagos activos y, si la reserva estaba PAGADA y el pago
// anulado era necesario para cubrir el total, revierte el estado
// (PAGADA→SEÑADA o PAGADA→EN_PROCESO) reabriendo el recordatorio de saldo
// si corresponde. Ver anularPago() en reservas.service.ts.
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resultado = await prisma.$transaction((tx) => anularPago(tx, req.params.id as string))
    if (!resultado) return res.status(404).json({ error: 'Pago no encontrado' })
    res.json(resultado)
  } catch (e) {
    next(e)
  }
})

export default router
