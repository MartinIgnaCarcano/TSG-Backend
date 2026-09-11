// =====================================================
// /api/recordatorios — usado por el Flujo 3 (cron 9 AM)
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { validateBody } from '../middleware/validate'
import {
  crearRecordatorioSchema,
  ejecutarRecordatorioSchema,
  resultadoEnvioSchema,
} from '../schemas/recordatorio.schema'
import { config } from '../config'
import { llamarWebhookN8n } from '../lib/n8n'

const router = Router()

// Lo que necesita n8n para armar el mensaje (cliente + ruta del viaje).
// Lo comparten el listado del cron y el GET por id que usa el envío
// manual, así el nodo que arma el texto recibe siempre la misma forma.
const INCLUDE_RESERVA = {
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
} as const

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
      include: INCLUDE_RESERVA,
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
      include: INCLUDE_RESERVA,
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
router.patch('/:id/ejecutar', validateBody(ejecutarRecordatorioSchema), async (req: Request, res: Response, next: NextFunction) => {
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

// PATCH /api/recordatorios/:id/resultado — n8n informa cómo terminó el envío
//
// El flujo ahora TOMA el recordatorio antes de mandar (PATCH /ejecutar, que
// es condicional), y recién después llama a Twilio. Eso cierra la deuda de
// A-6: dos corridas superpuestas del cron ya no mandan dos WhatsApp, porque
// la segunda recibe `yaEjecutado: true` y no envía. La contracara es que si
// Twilio falla, el recordatorio quedó marcado como ejecutado sin haber
// salido. Este endpoint lo resuelve: con ok=false lo devuelve a pendiente
// (con el error a la vista en el panel) y la próxima corrida lo reintenta.
router.patch('/:id/resultado', validateBody(resultadoEnvioSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const { ok, detalle } = req.body as { ok: boolean; detalle?: string }

    const r = ok
      ? await prisma.recordatorio.update({
          where: { id },
          data: { ejecutado: true, resultado: detalle || 'Enviado' },
        })
      : await prisma.recordatorio.update({
          where: { id },
          data: {
            ejecutado: false,
            fechaEjecucion: null,
            resultado: `Error al enviar: ${detalle || 'sin detalle'}`.slice(0, 500),
          },
        })
    res.json(r)
  } catch (e) {
    next(e)
  }
})

// POST /api/recordatorios/:id/enviar — "Enviar ahora" desde el panel
//
// Antes el botón del front solo hacía PATCH /ejecutar: marcaba el
// recordatorio y no mandaba nada. Ahora dispara el mismo camino que el cron
// (Flujo3, entrada por webhook) y espera el resultado del envío, así el
// operador ve si el WhatsApp salió o por qué no.
router.post('/:id/enviar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const r = await prisma.recordatorio.findUnique({ where: { id }, include: INCLUDE_RESERVA })
    if (!r) return res.status(404).json({ error: 'Recordatorio no encontrado' })
    if (r.ejecutado) {
      return res.status(409).json({ error: 'Este recordatorio ya fue enviado o marcado como ejecutado.' })
    }
    if (!r.reserva?.cliente?.telefono) {
      return res.status(422).json({ error: 'El cliente de esta reserva no tiene teléfono cargado.' })
    }

    const resultado = await llamarWebhookN8n<{ ok?: boolean; detalle?: string; sid?: string }>(
      config.n8nWebhookRecordatorioUrl,
      { recordatorioId: id },
      { nombre: 'Flujo3 · envío manual', timeoutMs: 30_000 },
    )

    if (!resultado?.ok) {
      return res.status(502).json({ error: `No se pudo enviar el WhatsApp: ${resultado?.detalle || 'n8n no informó el motivo'}` })
    }
    res.json({ ok: true, detalle: resultado.detalle, sid: resultado.sid })
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
router.post('/', validateBody(crearRecordatorioSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservaId, tipo, fechaProgramada } = req.body
    const r = await prisma.recordatorio.create({
      data: { reservaId, tipo, fechaProgramada },
    })
    res.status(201).json(r)
  } catch (e) {
    next(e)
  }
})

export default router
