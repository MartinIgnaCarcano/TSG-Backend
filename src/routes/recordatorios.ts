// =====================================================
// /api/recordatorios — usado por el Flujo 3 (cron 9 AM)
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/recordatorios?pendientes=true&fecha=YYYY-MM-DD
// Devuelve los recordatorios cuya fechaProgramada <= fin del día indicado
// y que aún no se ejecutaron. Si no se pasa fecha, usa hoy.
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fechaStr = (req.query.fecha as string | undefined) || new Date().toISOString().slice(0, 10)
    const pendientes = req.query.pendientes === 'true'
    const reservaId = req.query.reservaId as string | undefined

    const finDelDia = new Date(fechaStr + 'T23:59:59Z')

    const recordatorios = await prisma.recordatorio.findMany({
      where: {
        ...(pendientes && { ejecutado: false }),
        ...(pendientes && { fechaProgramada: { lte: finDelDia } }),
        ...(reservaId && { reservaId }),
      },
      include: {
        reserva: {
          include: {
            cliente: true,
            cotizacion: {
              include: {
                viaje: {
                  include: { origen: true, destino: true },
                },
              },
            },
          },
        },
      },
      orderBy: { fechaProgramada: 'asc' },
    })
    res.json(recordatorios)
  } catch (e) {
    next(e)
  }
})

// GET /api/recordatorios/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await prisma.recordatorio.findUnique({
      where: { id: req.params.id as string },
      include: { reserva: { include: { cliente: true } } },
    })
    if (!r) return res.status(404).json({ error: 'Recordatorio no encontrado' })
    res.json(r)
  } catch (e) {
    next(e)
  }
})

// PATCH /api/recordatorios/:id/ejecutar — el Flujo 3 lo llama después de enviar
//
// Hallazgo A-6 de la auditoría de ingeniería: era un `update` por id, sin
// condicionar a que el recordatorio siguiera pendiente. El cron de n8n
// reintenta ante timeout, así que un mismo recordatorio podía marcarse
// (y contabilizarse como enviado) dos veces, pisando la fecha y el
// resultado del envío original. Ahora la escritura es condicional: sólo
// pasa de pendiente a ejecutado, y una segunda llamada devuelve 200 con
// `yaEjecutado: true` en vez de volver a escribir. Es un no-op explícito,
// que es lo que un cliente que reintenta necesita para no reintentar en
// loop (a diferencia de un 409, que parece un error).
//
// Deuda conocida: esto hace idempotente el reintento del PATCH, no el
// solapamiento de dos corridas del cron. Si dos ticks de Flujo3 leen la
// lista de pendientes al mismo tiempo, los dos envían el WhatsApp antes
// de que ninguno marque nada. Cerrar eso requiere que el flujo tome el
// recordatorio ANTES de enviar (llamar a este endpoint primero y saltear
// el envío si responde `yaEjecutado: true`), que es un cambio en el
// workflow, no acá.
router.patch('/:id/ejecutar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const { resultado } = req.body

    const marcado = await prisma.recordatorio.updateMany({
      where: { id, ejecutado: false },
      data: {
        ejecutado: true,
        fechaEjecucion: new Date(),
        resultado: resultado || 'OK',
      },
    })

    const r = await prisma.recordatorio.findUnique({ where: { id } })
    if (!r) return res.status(404).json({ error: 'Recordatorio no encontrado' })

    res.json({ ...r, yaEjecutado: marcado.count === 0 })
  } catch (e) {
    next(e)
  }
})

// DELETE /api/recordatorios/:id — borrar definitivamente
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.recordatorio.delete({ where: { id: req.params.id as string } })
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// POST /api/recordatorios — crear uno manualmente (poco común)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservaId, tipo, fechaProgramada } = req.body
    const r = await prisma.recordatorio.create({
      data: { reservaId, tipo, fechaProgramada: new Date(fechaProgramada) },
    })
    res.status(201).json(r)
  } catch (e) {
    next(e)
  }
})

export default router
