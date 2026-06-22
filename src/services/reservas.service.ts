// =====================================================
// Lógica de negocio del flujo de reservas, separada de la ruta.
// La ruta (controlador) solo: valida input (Zod), llama al servicio,
// mapea el resultado/errores a HTTP. Toda la lógica de cálculo de
// saldo, inferencia de fechas y generación de recordatorios vive acá,
// donde se puede testear sin levantar Express.
// =====================================================
import { Prisma, PrismaClient, TipoRecordatorio } from '@prisma/client'
import { prisma } from '../lib/prisma'

type Db = PrismaClient | Prisma.TransactionClient

export function calcularSaldoPendiente(montoFinal: unknown, saldoPagado: unknown): number {
  return Number(montoFinal) - Number(saldoPagado)
}

/** Agrega `saldoPendiente` (campo calculado, no persistido) a una reserva. */
export function conSaldoPendiente<T extends { montoFinal: any; saldoPagado: any }>(
  reserva: T,
): T & { saldoPendiente: number } {
  return { ...reserva, saldoPendiente: calcularSaldoPendiente(reserva.montoFinal, reserva.saldoPagado) }
}

/**
 * Si no vienen fechaViaje/fechaRegreso explícitas, las infiere del
 * primer/último tramo del viaje asociado a la cotización.
 */
export async function inferirFechasViaje(
  cotizacionId: string,
  fechaViaje?: Date,
  fechaRegreso?: Date,
): Promise<{ fViaje?: Date; fRegreso?: Date }> {
  let fViaje = fechaViaje
  let fRegreso = fechaRegreso
  if (!fViaje || !fRegreso) {
    const cot = await prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
      include: { viaje: { include: { tramos: { orderBy: { orden: 'asc' } } } } },
    })
    const tramos = cot?.viaje?.tramos || []
    if (tramos.length > 0 && tramos[0].horaSalida) fViaje = fViaje ?? tramos[0].horaSalida
    if (tramos.length > 0 && tramos[tramos.length - 1].horaLlegada) {
      fRegreso = fRegreso ?? tramos[tramos.length - 1].horaLlegada ?? undefined
    }
  }
  return { fViaje, fRegreso }
}

/** Arma los recordatorios automáticos (PAGO_SALDO / CHECK_IN / POST_VIAJE) de una reserva nueva. */
export function construirRecordatorios(
  reservaId: string,
  montoFinal: number,
  saldoPagado: number,
  fViaje?: Date,
  fRegreso?: Date,
): { reservaId: string; tipo: TipoRecordatorio; fechaProgramada: Date }[] {
  if (!fViaje) return []
  const dias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
  const recordatorios: { reservaId: string; tipo: TipoRecordatorio; fechaProgramada: Date }[] = []

  const pendiente = calcularSaldoPendiente(montoFinal, saldoPagado)
  if (pendiente > 0) {
    recordatorios.push({ reservaId, tipo: TipoRecordatorio.PAGO_SALDO, fechaProgramada: dias(fViaje, -14) })
  }

  recordatorios.push({ reservaId, tipo: TipoRecordatorio.CHECK_IN, fechaProgramada: dias(fViaje, -1) })

  if (fRegreso) {
    recordatorios.push({ reservaId, tipo: TipoRecordatorio.POST_VIAJE, fechaProgramada: dias(fRegreso, 1) })
  }

  return recordatorios
}

/** Marca como ejecutados los recordatorios PAGO_SALDO pendientes de una reserva ya saldada. */
export function cerrarRecordatoriosPagoSaldo(db: Db, reservaId: string) {
  return db.recordatorio.updateMany({
    where: { reservaId, tipo: TipoRecordatorio.PAGO_SALDO, ejecutado: false },
    data: {
      ejecutado: true,
      fechaEjecucion: new Date(),
      resultado: 'Saldo cancelado — marcado automáticamente al registrar pago total',
    },
  })
}

/** Si el saldo cubre el monto final, cierra los recordatorios de pago pendientes. */
export async function cerrarRecordatoriosSiCorresponde(
  db: Db,
  reservaId: string,
  montoFinal: unknown,
  saldoPagado: unknown,
) {
  const pendiente = calcularSaldoPendiente(montoFinal, saldoPagado)
  if (Number(montoFinal) > 0 && pendiente <= 0) {
    await cerrarRecordatoriosPagoSaldo(db, reservaId)
  }
}
