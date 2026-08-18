import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { EstadoReserva, TipoDocumento } from '@prisma/client'
import { construirVoucherHtml, VoucherSnapshot } from '../templates/voucher.template'
import { construirContratoHtml, ContratoSnapshot } from '../templates/contrato.template'
import { generarYGuardarDocumento, firmarUrlDocumento } from '../lib/documentos'
import { notificarDocumentoEmitido } from '../lib/notificaciones'
import { validateBody } from '../middleware/validate'
import {
  crearReservaSchema,
  actualizarReservaSchema,
  registrarPagoSchema,
  cancelarReservaSchema,
  actualizarEstadoSchema,
} from '../schemas/reserva.schema'
import {
  conSaldoPendiente,
  inferirFechasViaje,
  construirRecordatorios,
  cerrarRecordatoriosSiCorresponde,
  transicionarEstado,
  registrarPago,
  reservarVersionDocumento,
} from '../services/reservas.service'
import { parsePaginacion } from '../lib/pagination'
import { operacionesCarasRateLimit } from '../middleware/rateLimits'
import { generarNumero } from '../lib/identificadores'

const router = Router()

// GET /api/reservas
//   ?clienteId=...
//   ?estado=EN_PROCESO
//   ?vencidas=true   → reservas con saldoPendiente>0 y fechaViaje <= now+7d (usadas por el Flujo 4)
//   ?page&?pageSize  → opcional; sin esto, devuelve array plano (compat n8n/front)
// Relaciones que acompañan a cada reserva del listado. Se extrae a una
// constante porque ahora se usa en las dos ramas (con y sin paginación).
const INCLUDE_LISTADO = {
  cliente: true,
  cotizacion: {
    include: {
      viaje: {
        include: {
          origen: true,
          destino: true,
          tramos: { where: { baja: null }, orderBy: { orden: 'asc' as const } },
        },
      },
    },
  },
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clienteId = req.query.clienteId as string | undefined
    const estado = req.query.estado as EstadoReserva | undefined
    const vencidas = req.query.vencidas === 'true'

    const where: any = { baja: null }
    if (clienteId) where.clienteId = clienteId
    if (estado) where.estado = estado

    // Hallazgo M-2 de la auditoría de ingeniería: antes este endpoint
    // traía la tabla entera con todas sus relaciones anidadas y después
    // filtraba y paginaba en JavaScript. Con diez reservas no se nota; el
    // problema es que el trabajo argumenta escalabilidad y esto es
    // exactamente lo que no escala.
    //
    // El filtro `vencidas` estaba en JS por una razón real: compara dos
    // columnas (`montoFinal > saldoPagado`) y la API de consultas de
    // Prisma no expresa comparaciones entre columnas. Se resuelve con una
    // consulta cruda que devuelve sólo los ids y se usa como filtro — la
    // comparación la hace PostgreSQL y el resto del endpoint no cambia.
    if (vencidas) {
      const limite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const filas = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
          FROM reservas
         WHERE baja IS NULL
           AND estado::text <> 'CANCELADA'
           AND fecha_viaje IS NOT NULL
           AND fecha_viaje <= ${limite}
           AND monto_final > saldo_pagado
      `
      where.id = { in: filas.map((f) => f.id) }
    }

    const paginacion = parsePaginacion(req.query as Record<string, unknown>)

    // Sin ?page/?pageSize se devuelve el array plano de siempre, por
    // compatibilidad con el front y con los workflows de n8n.
    if (!paginacion) {
      const reservas = await prisma.reserva.findMany({
        where,
        include: INCLUDE_LISTADO,
        orderBy: { alta: 'desc' },
      })
      return res.json(reservas.map(conSaldoPendiente))
    }

    const [reservas, total] = await Promise.all([
      prisma.reserva.findMany({
        where,
        include: INCLUDE_LISTADO,
        orderBy: { alta: 'desc' },
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      prisma.reserva.count({ where }),
    ])

    res.json({
      data: reservas.map(conSaldoPendiente),
      page: paginacion.page,
      pageSize: paginacion.pageSize,
      total,
      totalPages: Math.ceil(total / paginacion.pageSize),
    })
  } catch (e) {
    next(e)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
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
        pagos: { where: { baja: null }, orderBy: { fechaPago: 'desc' } },
        pasajeros: { where: { baja: null } },
        // Igual que en GET /api/documentos: no se devuelven las filas con
        // la versión reservada pero sin archivo todavía (hallazgo A-2).
        documentos: { where: { url: { not: null } }, orderBy: [{ tipo: 'asc' }, { version: 'desc' }] },
      },
    })
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })
    res.json(conSaldoPendiente(reserva))
  } catch (e) {
    next(e)
  }
})

// POST /api/reservas — crea la reserva Y los recordatorios automáticamente
router.post('/', validateBody(crearReservaSchema), async (req: Request, res: Response, next: NextFunction) => {
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
    const numeroReserva = generarNumero('RES')

    const { fViaje, fRegreso } = await inferirFechasViaje(cotizacionId, fechaViaje, fechaRegreso)

    // Hallazgo A-5 de la auditoría de ingeniería: la reserva y sus
    // recordatorios se crean ahora en una sola transacción. Antes eran
    // dos escrituras sueltas y, si la segunda fallaba, quedaba una
    // reserva sin ningún recordatorio programado: no se avisaba el saldo
    // ni el check-in, y nadie se enteraba hasta que el cliente reclamaba.
    //
    // La seña inicial tampoco se escribe ya como un número suelto en
    // `saldoPagado`: se registra como un `Pago` real (hallazgo A-4), para
    // que el invariante `saldoPagado = SUM(pagos activos)` valga también
    // para las reservas que nacen con seña, y para que esa plata quede
    // auditada como cualquier otro cobro.
    const senaInicial = Number(saldoPagado ?? 0)

    const reserva = await prisma.$transaction(async (tx) => {
      const creada = await tx.reserva.create({
        data: {
          clienteId,
          cotizacionId,
          tipoReserva,
          montoFinal,
          numeroReserva,
          observaciones,
          fechaViaje: fViaje,
          fechaRegreso: fRegreso,
        },
        include: { cliente: true, cotizacion: true },
      })

      const recordatorios = construirRecordatorios(creada.id, Number(montoFinal), senaInicial, fViaje, fRegreso)
      if (recordatorios.length > 0) {
        await tx.recordatorio.createMany({ data: recordatorios })
      }

      if (senaInicial > 0) {
        await registrarPago(tx, creada.id, {
          monto: senaInicial,
          observaciones: 'Seña registrada al crear la reserva',
        })
        return tx.reserva.findUniqueOrThrow({
          where: { id: creada.id },
          include: { cliente: true, cotizacion: true },
        })
      }

      return creada
    })

    res.status(201).json(conSaldoPendiente(reserva))
  } catch (e) {
    next(e)
  }
})

// PUT /api/reservas/:id
router.put('/:id', validateBody(actualizarReservaSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // `saldoPagado` no se acepta acá a propósito (hallazgo A-4): el saldo
    // sólo se mueve creando o anulando un Pago, para que siempre haya un
    // registro que lo justifique.
    const { cotizacionId, tipoReserva, montoFinal, estado, observaciones, motivoCancelacion } = req.body
    const id = req.params.id as string

    const reserva = await prisma.$transaction(async (tx) => {
      let actualizada = await tx.reserva.update({
        where: { id },
        data: { cotizacionId, tipoReserva, montoFinal, observaciones, motivoCancelacion },
      })
      // El cambio de estado pasa siempre por la máquina de estados validada,
      // nunca por un `set` directo — así no se pueden saltear pasos desde el PUT genérico.
      if (estado && estado !== actualizada.estado) {
        actualizada = await transicionarEstado(tx, id, estado, { motivoCancelacion })
      }
      await cerrarRecordatoriosSiCorresponde(tx, id, actualizada.montoFinal, actualizada.saldoPagado)
      return actualizada
    })

    res.json(conSaldoPendiente(reserva))
  } catch (e) {
    next(e)
  }
})

// PATCH /api/reservas/:id/estado — único endpoint genérico para mover la máquina de estados
router.patch('/:id/estado', validateBody(actualizarEstadoSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { estado, motivo } = req.body
    const reserva = await transicionarEstado(prisma, req.params.id as string, estado, { motivoCancelacion: motivo })
    res.json(conSaldoPendiente(reserva))
  } catch (e) {
    next(e)
  }
})

// PATCH /api/reservas/:id/confirmar — EN_PROCESO -> SEÑADA (queda registrada con seña)
// El contrato ya no se dispara desde acá: se emite (y se avisa por
// WhatsApp/email) recién cuando se aprieta "Emitir contrato" en el front,
// que llama a POST /:id/contrato y notifica a n8n al instante — ver
// lib/notificaciones.ts. Antes se programaba un Recordatorio CONTRATO acá
// para que el cron de Flujo3 lo recogiera a las 9AM, pero eso podía dejar
// al cliente esperando el contrato hasta 24hs.
router.patch('/:id/confirmar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reserva = await transicionarEstado(prisma, req.params.id as string, EstadoReserva.SEÑADA)
    res.json(reserva)
  } catch (e) {
    next(e)
  }
})

// PATCH /api/reservas/:id/cancelar  ← usado por el Flujo 4
router.patch('/:id/cancelar', validateBody(cancelarReservaSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { motivo } = req.body
    const reserva = await transicionarEstado(prisma, req.params.id as string, EstadoReserva.CANCELADA, {
      motivoCancelacion: motivo || 'Cancelada automáticamente por vencimiento',
    })
    res.json(reserva)
  } catch (e) {
    next(e)
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
router.patch('/:id/pago', validateBody(registrarPagoSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { monto, medioPago, referencia, observaciones } = req.body
    const id = req.params.id as string
    if (!id) return res.status(400).json({ error: 'ID requerido' })

    const { reserva } = await prisma.$transaction((tx) =>
      registrarPago(tx, id, { monto, medioPago, referencia, observaciones }),
    )

    res.json(conSaldoPendiente(reserva))
  } catch (e) {
    next(e)
  }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reserva = await prisma.reserva.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(reserva)
  } catch (e) {
    next(e)
  }
})

// POST /api/reservas/:id/voucher — Fase B.
// Requiere PAGADA (o DOCUMENTADA, para reemitir/versionar) y al menos un
// Pasajero cargado. Arma el snapshot, genera el PDF (PDFShift o mock HTML),
// lo registra en DocumentoGenerado y avanza la reserva a DOCUMENTADA.
router.post('/:id/voucher', operacionesCarasRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const reserva = await prisma.reserva.findUnique({
      where: { id },
      include: {
        cliente: true,
        pasajeros: { where: { baja: null } },
        cotizacion: {
          include: {
            hotel: true,
            viaje: {
              include: {
                origen: true,
                destino: true,
                tramos: { where: { baja: null }, orderBy: { orden: 'asc' }, include: { origen: true, destino: true } },
              },
            },
          },
        },
      },
    })
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })

    if (reserva.estado !== EstadoReserva.PAGADA && reserva.estado !== EstadoReserva.DOCUMENTADA) {
      return res
        .status(409)
        .json({ error: `No se puede emitir voucher: la reserva está en estado ${reserva.estado}, debe estar PAGADA.` })
    }
    if (reserva.pasajeros.length === 0) {
      return res
        .status(422)
        .json({ error: 'La reserva no tiene pasajeros cargados (faltan datos de documento para el voucher).' })
    }

    const viaje = reserva.cotizacion.viaje
    const cotizacion = reserva.cotizacion
    // Hallazgo A-2: el número de versión se reserva de forma atómica (con
    // lock de la fila de la reserva) antes de generar el PDF, en vez de
    // calcularse con un count() suelto que dos emisiones simultáneas
    // resolvían al mismo número. Ver reservarVersionDocumento().
    const { id: documentoId, version } = await reservarVersionDocumento(prisma, id, TipoDocumento.VOUCHER)
    const numeroVoucher = generarNumero('VOU')

    const snapshot: VoucherSnapshot = {
      numeroReserva: reserva.numeroReserva,
      numeroVoucher,
      version,
      cliente: {
        nombre: reserva.cliente.nombre,
        apellido: reserva.cliente.apellido,
        email: reserva.cliente.email,
        telefono: reserva.cliente.telefono,
      },
      pasajeros: reserva.pasajeros.map((p) => ({
        nombre: p.nombre,
        apellido: p.apellido,
        documentoTipo: p.documentoTipo,
        documentoNumero: p.documentoNumero,
      })),
      origenNombre: viaje.origen.nombre,
      origenIATA: viaje.origen.codigoIATA,
      destinoNombre: viaje.destino.nombre,
      destinoIATA: viaje.destino.codigoIATA,
      tramos: viaje.tramos.map((t) => ({
        origenIATA: t.origen.codigoIATA,
        destinoIATA: t.destino.codigoIATA,
        aerolinea: t.aerolinea,
        horaSalida: t.horaSalida ? t.horaSalida.toISOString() : null,
        horaLlegada: t.horaLlegada ? t.horaLlegada.toISOString() : null,
      })),
      hotel: cotizacion.hotel
        ? {
            nombre: cotizacion.hotel.nombre,
            direccion: cotizacion.hotel.direccion,
            estrellas: cotizacion.hotel.estrellas,
            noches: cotizacion.noches,
          }
        : null,
      fechaViaje: reserva.fechaViaje ? reserva.fechaViaje.toISOString() : null,
      fechaRegreso: reserva.fechaRegreso ? reserva.fechaRegreso.toISOString() : null,
      montoFinal: Number(reserva.montoFinal),
      moneda: cotizacion.moneda,
      fechaEmision: new Date().toISOString(),
    }

    const html = construirVoucherHtml(snapshot)
    // Si la generación del PDF falla, se libera la versión reservada para
    // que el próximo intento no arranque en el número siguiente dejando un
    // hueco en la numeración.
    const guardado = await generarYGuardarDocumento(html, `voucher-${reserva.numeroReserva}`).catch(
      async (e) => {
        await prisma.documentoGenerado.delete({ where: { id: documentoId } }).catch(() => {})
        throw e
      },
    )

    const documento = await prisma.$transaction(async (tx) => {
      const doc = await tx.documentoGenerado.update({
        where: { id: documentoId },
        data: {
          url: guardado.url,
          hash: guardado.hash,
          datosSnapshot: snapshot as any,
        },
      })
      if (reserva.estado === EstadoReserva.PAGADA) {
        await transicionarEstado(tx, id, EstadoReserva.DOCUMENTADA)
      }
      return doc
    })

    // Fase S3: se manda la URL firmada (con vencimiento), no la ruta
    // estática — el link va por WhatsApp/email directo al cliente.
    const urlFirmada = firmarUrlDocumento(documento.id)
    notificarDocumentoEmitido({ tipo: 'VOUCHER', reservaId: id, documentoUrl: urlFirmada })

    res.status(201).json({ ...documento, url: urlFirmada })
  } catch (e) {
    next(e)
  }
})

// POST /api/reservas/:id/contrato — Fase C.
// A diferencia del voucher, no exige PAGADA (el contrato es el acuerdo de
// servicios, no comprobante de pago total) ni mueve la máquina de estados:
// sólo requiere que la reserva no esté cancelada y tenga pasajeros cargados.
// Cada emisión crea una versión nueva; la aceptación se registra aparte
// vía POST /api/documentos/:id/aceptar.
router.post('/:id/contrato', operacionesCarasRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const reserva = await prisma.reserva.findUnique({
      where: { id },
      include: {
        cliente: true,
        pasajeros: { where: { baja: null } },
        cotizacion: { include: { viaje: { include: { origen: true, destino: true } } } },
      },
    })
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' })

    if (reserva.estado === EstadoReserva.CANCELADA) {
      return res.status(409).json({ error: 'No se puede emitir contrato: la reserva está cancelada.' })
    }
    if (reserva.pasajeros.length === 0) {
      return res
        .status(422)
        .json({ error: 'La reserva no tiene pasajeros cargados (faltan datos de documento para el contrato).' })
    }

    const viaje = reserva.cotizacion.viaje
    // Hallazgo A-2: mismo criterio que en el voucher.
    const { id: documentoId, version } = await reservarVersionDocumento(prisma, id, TipoDocumento.CONTRATO)
    const numeroContrato = generarNumero('CON')

    const snapshot: ContratoSnapshot = {
      numeroReserva: reserva.numeroReserva,
      numeroContrato,
      version,
      cliente: {
        nombre: reserva.cliente.nombre,
        apellido: reserva.cliente.apellido,
        email: reserva.cliente.email,
        telefono: reserva.cliente.telefono,
      },
      pasajeros: reserva.pasajeros.map((p) => ({
        nombre: p.nombre,
        apellido: p.apellido,
        documentoTipo: p.documentoTipo,
        documentoNumero: p.documentoNumero,
      })),
      origenNombre: viaje.origen.nombre,
      destinoNombre: viaje.destino.nombre,
      fechaViaje: reserva.fechaViaje ? reserva.fechaViaje.toISOString() : null,
      fechaRegreso: reserva.fechaRegreso ? reserva.fechaRegreso.toISOString() : null,
      montoFinal: Number(reserva.montoFinal),
      saldoPagado: Number(reserva.saldoPagado),
      moneda: reserva.cotizacion.moneda,
      tipoReserva: reserva.tipoReserva,
      fechaEmision: new Date().toISOString(),
    }

    const html = construirContratoHtml(snapshot)
    const guardado = await generarYGuardarDocumento(html, `contrato-${reserva.numeroReserva}`).catch(
      async (e) => {
        await prisma.documentoGenerado.delete({ where: { id: documentoId } }).catch(() => {})
        throw e
      },
    )

    const documento = await prisma.documentoGenerado.update({
      where: { id: documentoId },
      data: {
        url: guardado.url,
        hash: guardado.hash,
        datosSnapshot: snapshot as any,
      },
    })

    // Fase S3: se manda la URL firmada (con vencimiento), no la ruta
    // estática — el link va por WhatsApp/email directo al cliente.
    const urlFirmada = firmarUrlDocumento(documento.id)
    notificarDocumentoEmitido({ tipo: 'CONTRATO', reservaId: id, documentoUrl: urlFirmada })

    res.status(201).json({ ...documento, url: urlFirmada })
  } catch (e) {
    next(e)
  }
})

export default router
