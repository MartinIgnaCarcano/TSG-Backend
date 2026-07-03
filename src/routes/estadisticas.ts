// =====================================================
// Fase M1 (backend) — Dashboard de métricas de negocio.
// Una sola ruta de solo lectura, agregada con Prisma groupBy/aggregate.
// Todas las queries respetan baja: null en los modelos que tienen borrado
// lógico (Reserva, Cotizacion, Pago). DocumentoGenerado no tiene columna
// `baja` en el schema, así que ahí no corresponde filtrarla.
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { EstadoReserva, TipoDocumento } from '@prisma/client'
import { prisma } from '../lib/prisma'

const router = Router()

const DIAS_CONVERSION = 90
const MESES_INGRESOS = 6

function inicioDeMes(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

// GET /api/estadisticas
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const ahora = new Date()

    // ---------------------------------------------------
    // 1) Funnel del ciclo: reservas activas por EstadoReserva.
    //    Se completan en 0 los estados sin registros para que el front
    //    dibuje el funnel completo sin huecos.
    // ---------------------------------------------------
    const reservasPorEstadoRaw = await prisma.reserva.groupBy({
      by: ['estado'],
      where: { baja: null },
      _count: { _all: true },
    })
    const conteoPorEstado = new Map(reservasPorEstadoRaw.map((r) => [r.estado, r._count._all]))
    const reservasPorEstado = Object.values(EstadoReserva).map((estado) => ({
      estado,
      cantidad: conteoPorEstado.get(estado) ?? 0,
    }))

    // ---------------------------------------------------
    // 2) Conversión: cotizaciones ACEPTADAS / total emitidas, últimos 90 días.
    // ---------------------------------------------------
    const desdeConversion = new Date(ahora.getTime() - DIAS_CONVERSION * 24 * 60 * 60 * 1000)
    const [totalCotizaciones, cotizacionesAceptadas] = await Promise.all([
      prisma.cotizacion.count({
        where: { baja: null, fechaCotizacion: { gte: desdeConversion } },
      }),
      prisma.cotizacion.count({
        where: { baja: null, fechaCotizacion: { gte: desdeConversion }, estado: 'ACEPTADA' },
      }),
    ])
    const tasaConversion = totalCotizaciones > 0 ? cotizacionesAceptadas / totalCotizaciones : 0

    // ---------------------------------------------------
    // 3) Ingresos: SUM(Pago.monto) por mes (últimos 6, incluye el actual)
    //    y por medioPago, ambos acotados a la misma ventana de 6 meses
    //    para que sea un único período coherente en el dashboard.
    // ---------------------------------------------------
    const inicioVentana = inicioDeMes(
      new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - (MESES_INGRESOS - 1), 1)),
    )

    const mesesRango: { anio: number; mes: number; desde: Date; hasta: Date }[] = []
    for (let i = 0; i < MESES_INGRESOS; i++) {
      const desde = new Date(Date.UTC(inicioVentana.getUTCFullYear(), inicioVentana.getUTCMonth() + i, 1))
      const hasta = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 1))
      mesesRango.push({ anio: desde.getUTCFullYear(), mes: desde.getUTCMonth() + 1, desde, hasta })
    }

    const [ingresosPorMesRaw, ingresosPorMedioPagoRaw] = await Promise.all([
      Promise.all(
        mesesRango.map(({ desde, hasta }) =>
          prisma.pago.aggregate({
            _sum: { monto: true },
            where: { baja: null, fechaPago: { gte: desde, lt: hasta } },
          }),
        ),
      ),
      prisma.pago.groupBy({
        by: ['medioPago'],
        where: { baja: null, fechaPago: { gte: inicioVentana } },
        _sum: { monto: true },
      }),
    ])

    const ingresos = {
      porMes: mesesRango.map(({ anio, mes }, i) => ({
        anio,
        mes,
        total: Number(ingresosPorMesRaw[i]._sum.monto ?? 0),
      })),
      porMedioPago: ingresosPorMedioPagoRaw.map((r) => ({
        medioPago: r.medioPago,
        total: Number(r._sum.monto ?? 0),
      })),
    }

    // ---------------------------------------------------
    // 4) Top 5 destinos por cantidad de cotizaciones.
    //    Cotizacion no tiene destinoId propio (cuelga de Viaje), así que
    //    agrupamos primero por viajeId con Prisma groupBy y después
    //    resolvemos destino y sumamos en memoria — no hay forma de hacer
    //    ese join dentro de un único groupBy de Prisma.
    // ---------------------------------------------------
    const cotizacionesPorViaje = await prisma.cotizacion.groupBy({
      by: ['viajeId'],
      where: { baja: null },
      _count: { _all: true },
    })

    const viajeIds = cotizacionesPorViaje.map((c) => c.viajeId)
    const viajes = viajeIds.length
      ? await prisma.viaje.findMany({
          where: { id: { in: viajeIds } },
          select: { id: true, destino: { select: { id: true, nombre: true, codigoIATA: true } } },
        })
      : []
    const destinoPorViajeId = new Map(viajes.map((v) => [v.id, v.destino]))

    const acumuladoPorDestino = new Map<
      string,
      { destinoId: string; nombre: string; codigoIATA: string; cantidadCotizaciones: number }
    >()
    for (const { viajeId, _count } of cotizacionesPorViaje) {
      const destino = destinoPorViajeId.get(viajeId)
      if (!destino) continue
      const acumulado = acumuladoPorDestino.get(destino.id)
      if (acumulado) {
        acumulado.cantidadCotizaciones += _count._all
      } else {
        acumuladoPorDestino.set(destino.id, {
          destinoId: destino.id,
          nombre: destino.nombre,
          codigoIATA: destino.codigoIATA,
          cantidadCotizaciones: _count._all,
        })
      }
    }
    const topDestinos = Array.from(acumuladoPorDestino.values())
      .sort((a, b) => b.cantidadCotizaciones - a.cantidadCotizaciones)
      .slice(0, 5)

    // ---------------------------------------------------
    // 5) Documentos emitidos por tipo (VOUCHER/CONTRATO). Sin filtro de
    //    baja: DocumentoGenerado no tiene borrado lógico en el schema.
    // ---------------------------------------------------
    const documentosPorTipoRaw = await prisma.documentoGenerado.groupBy({
      by: ['tipo'],
      _count: { _all: true },
    })
    const conteoPorTipoDocumento = new Map(documentosPorTipoRaw.map((d) => [d.tipo, d._count._all]))
    const documentosPorTipo = [TipoDocumento.VOUCHER, TipoDocumento.CONTRATO].map((tipo) => ({
      tipo,
      cantidad: conteoPorTipoDocumento.get(tipo) ?? 0,
    }))

    res.json({
      reservasPorEstado,
      conversion: {
        periodoDias: DIAS_CONVERSION,
        totalCotizaciones,
        cotizacionesAceptadas,
        tasaConversion,
      },
      ingresos,
      topDestinos,
      documentosPorTipo,
    })
  } catch (e) {
    next(e)
  }
})

export default router
