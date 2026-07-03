// =====================================================
// Lógica de negocio del flujo de reservas, separada de la ruta.
// La ruta (controlador) solo: valida input (Zod), llama al servicio,
// mapea el resultado/errores a HTTP. Toda la lógica de cálculo de
// saldo, inferencia de fechas y generación de recordatorios vive acá,
// donde se puede testear sin levantar Express.
// =====================================================
import { EstadoReserva, MedioPago, Prisma, PrismaClient, TipoRecordatorio } from '@prisma/client'
import { prisma } from '../lib/prisma'

type Db = PrismaClient | Prisma.TransactionClient

// =====================================================
// Máquina de estados de Reserva (Fase E)
// =====================================================

/**
 * Transiciones permitidas desde cada estado. CANCELADA y FINALIZADA son terminales.
 *
 * PAGADA -> SEÑADA y PAGADA -> EN_PROCESO (Fase S5) son transiciones inversas
 * que solo dispara `anularPago` cuando anular un pago deja de cubrir el
 * total de la reserva. No son parte del flujo normal hacia adelante, pero
 * viven acá (y no en un chequeo aparte) para que el PATCH /:id/estado
 * genérico y el resto de la máquina de estados sigan siendo la única
 * fuente de verdad sobre qué transiciones existen.
 */
export const TRANSICIONES_VALIDAS: Record<EstadoReserva, EstadoReserva[]> = {
  EN_PROCESO: [EstadoReserva.SEÑADA, EstadoReserva.PAGADA, EstadoReserva.CANCELADA],
  SEÑADA: [EstadoReserva.PAGADA, EstadoReserva.CANCELADA],
  PAGADA: [
    EstadoReserva.DOCUMENTADA,
    EstadoReserva.CANCELADA,
    EstadoReserva.SEÑADA, // solo por anulación de pago (ver anularPago)
    EstadoReserva.EN_PROCESO, // solo por anulación de pago (ver anularPago)
  ],
  DOCUMENTADA: [EstadoReserva.EN_VIAJE, EstadoReserva.CANCELADA],
  EN_VIAJE: [EstadoReserva.FINALIZADA, EstadoReserva.CANCELADA],
  FINALIZADA: [],
  CANCELADA: [],
}

export class TransicionInvalidaError extends Error {
  constructor(desde: EstadoReserva, hacia: EstadoReserva) {
    super(`No se puede pasar de ${desde} a ${hacia}`)
    this.name = 'TransicionInvalidaError'
  }
}

/**
 * Único punto de entrada para cambiar el estado de una reserva. Valida la
 * transición contra TRANSICIONES_VALIDAS antes de escribir en la base —
 * así vouchers/contratos/recordatorios pueden confiar en que, por ejemplo,
 * una reserva DOCUMENTADA realmente pasó por PAGADA antes.
 */
export async function transicionarEstado(
  db: Db,
  reservaId: string,
  nuevoEstado: EstadoReserva,
  opts: { motivoCancelacion?: string } = {},
) {
  const actual = await db.reserva.findUnique({ where: { id: reservaId } })
  if (!actual) throw new Error('Reserva no encontrada')
  if (actual.estado === nuevoEstado) return actual // no-op, ya está en ese estado

  const permitidos = TRANSICIONES_VALIDAS[actual.estado] ?? []
  if (!permitidos.includes(nuevoEstado)) {
    throw new TransicionInvalidaError(actual.estado, nuevoEstado)
  }

  // Fase S4: el update va condicionado al estado que acabamos de leer
  // (`where: { estado: actual.estado }`), no un update ciego por id. Si
  // entre el findUnique y este updateMany otro proceso ya movió la
  // reserva a otro estado (TOCTOU: dos requests concurrentes sobre la
  // misma reserva), acá no matchea ninguna fila y count da 0 — se trata
  // como transición inválida (409 vía S1) en vez de pisar silenciosamente
  // el cambio del otro proceso.
  const r = await db.reserva.updateMany({
    where: { id: reservaId, estado: actual.estado },
    data: {
      estado: nuevoEstado,
      ...(nuevoEstado === EstadoReserva.CANCELADA && opts.motivoCancelacion
        ? { motivoCancelacion: opts.motivoCancelacion }
        : {}),
    },
  })
  if (r.count === 0) throw new TransicionInvalidaError(actual.estado, nuevoEstado)

  return db.reserva.findUniqueOrThrow({ where: { id: reservaId } })
}

/**
 * Si el saldo cubre el monto final y la reserva todavía no avanzó a PAGADA
 * (o más), la mueve a PAGADA. Se usa junto a cerrarRecordatoriosSiCorresponde
 * cada vez que se registra un pago.
 *
 * Antes acá también se programaba el Recordatorio VOUCHER para que el cron
 * de Flujo3 lo recogiera a las 9AM. Ya no: el voucher se emite (y se avisa
 * por WhatsApp/email al instante) cuando se aprieta "Emitir voucher" en el
 * front — ver POST /reservas/:id/voucher y lib/notificaciones.ts.
 */
export async function avanzarAPagadaSiCorresponde(
  db: Db,
  reservaId: string,
  estadoActual: EstadoReserva,
  montoFinal: unknown,
  saldoPagado: unknown,
) {
  const pendiente = calcularSaldoPendiente(montoFinal, saldoPagado)
  const puedeAvanzar = TRANSICIONES_VALIDAS[estadoActual]?.includes(EstadoReserva.PAGADA)
  if (Number(montoFinal) > 0 && pendiente <= 0 && puedeAvanzar) {
    await transicionarEstado(db, reservaId, EstadoReserva.PAGADA)
  }
}

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

/**
 * Simétrico a `cerrarRecordatoriosPagoSaldo` (Fase S5): reabre los
 * recordatorios PAGO_SALDO que se habían marcado como ejecutados
 * automáticamente al saldar la reserva, para el caso en que anular un
 * pago vuelve a dejar saldo pendiente. Sólo toca los que se cerraron por
 * ese mecanismo automático (match por `resultado`), no uno cerrado o
 * editado a mano por otro motivo.
 */
export function reabrirRecordatoriosPagoSaldo(db: Db, reservaId: string) {
  return db.recordatorio.updateMany({
    where: {
      reservaId,
      tipo: TipoRecordatorio.PAGO_SALDO,
      ejecutado: true,
      resultado: { contains: 'marcado automáticamente al registrar pago' },
    },
    data: {
      ejecutado: false,
      fechaEjecucion: null,
      resultado: 'Reabierto automáticamente: se anuló un pago y quedó saldo pendiente',
    },
  })
}

/** Si, tras recalcular, queda saldo pendiente, reabre los recordatorios de pago cerrados automáticamente. */
export async function reabrirRecordatoriosSiCorresponde(
  db: Db,
  reservaId: string,
  montoFinal: unknown,
  saldoPagado: unknown,
) {
  const pendiente = calcularSaldoPendiente(montoFinal, saldoPagado)
  if (pendiente > 0) {
    await reabrirRecordatoriosPagoSaldo(db, reservaId)
  }
}

// =====================================================
// Conciliación de pagos (Fase D)
// =====================================================

export interface DatosPago {
  monto: number
  medioPago?: MedioPago
  referencia?: string | null
  observaciones?: string | null
  fechaPago?: Date
}

/**
 * Único punto de entrada para registrar un pago: crea el Pago (auditable,
 * con medio/referencia) y, en la misma transacción, incrementa el cache
 * `saldoPagado` de la Reserva, cierra recordatorios de saldo si corresponde
 * y avanza el estado a PAGADA si el saldo queda cubierto. Usado tanto por
 * `PATCH /reservas/:id/pago` (compat n8n/front viejo) como por
 * `POST /api/pagos` (alta directa con detalle de medio de pago).
 */
export async function registrarPago(tx: Prisma.TransactionClient, reservaId: string, datos: DatosPago) {
  const pago = await tx.pago.create({
    data: {
      reservaId,
      monto: datos.monto,
      medioPago: datos.medioPago ?? MedioPago.OTRO,
      referencia: datos.referencia ?? undefined,
      observaciones: datos.observaciones ?? undefined,
      ...(datos.fechaPago ? { fechaPago: datos.fechaPago } : {}),
    },
  })

  const reserva = await tx.reserva.update({
    where: { id: reservaId },
    data: { saldoPagado: { increment: datos.monto } },
  })

  await cerrarRecordatoriosSiCorresponde(tx, reservaId, reserva.montoFinal, reserva.saldoPagado)
  await avanzarAPagadaSiCorresponde(tx, reservaId, reserva.estado, reserva.montoFinal, reserva.saldoPagado)

  const reservaFinal = await tx.reserva.findUniqueOrThrow({ where: { id: reservaId } })
  return { pago, reserva: reservaFinal }
}

/**
 * Anula (baja lógica) un pago y concilia la reserva en la misma
 * transacción (Fase S5): el problema que resuelve es que antes `DELETE
 * /api/pagos/:id` sólo marcaba `baja` en el Pago sin tocar la reserva,
 * rompiendo el invariante "saldoPagado = SUM(pagos activos)" justo al
 * corregir un error de carga.
 *
 * `saldoPagado` se recalcula desde la fuente de verdad (SUM de los pagos
 * con `baja: null`), no restando el monto anulado — así el invariante se
 * sostiene aunque el cache ya estuviera desincronizado por otro motivo.
 * Si la reserva estaba PAGADA y el nuevo saldo deja de cubrir el total,
 * revierte el estado (PAGADA→SEÑADA si queda saldo parcial, PAGADA→
 * EN_PROCESO si queda en 0) y reabre el recordatorio PAGO_SALDO si
 * corresponde. Si la reserva ya avanzó más allá de PAGADA (DOCUMENTADA,
 * EN_VIAJE, ...) no se revierte el estado — el voucher/contrato ya se
 * emitió — pero el saldo sí se recalcula igual.
 *
 * Devuelve `null` si el pago no existe. Si el pago ya estaba anulado, es
 * no-op (no vuelve a recalcular ni a revertir estado por segunda vez).
 */
export async function anularPago(tx: Prisma.TransactionClient, pagoId: string) {
  const pagoActual = await tx.pago.findUnique({ where: { id: pagoId } })
  if (!pagoActual) return null

  if (pagoActual.baja) {
    const reservaActual = await tx.reserva.findUniqueOrThrow({ where: { id: pagoActual.reservaId } })
    return { pago: pagoActual, reserva: conSaldoPendiente(reservaActual) }
  }

  const pago = await tx.pago.update({ where: { id: pagoId }, data: { baja: new Date() } })
  const reservaAntes = await tx.reserva.findUniqueOrThrow({ where: { id: pago.reservaId } })

  const agregado = await tx.pago.aggregate({
    where: { reservaId: pago.reservaId, baja: null },
    _sum: { monto: true },
  })
  const nuevoSaldo = agregado._sum.monto ?? new Prisma.Decimal(0)

  await tx.reserva.update({ where: { id: pago.reservaId }, data: { saldoPagado: nuevoSaldo } })

  const pendiente = calcularSaldoPendiente(reservaAntes.montoFinal, nuevoSaldo)
  if (reservaAntes.estado === EstadoReserva.PAGADA && pendiente > 0) {
    const destino = Number(nuevoSaldo) === 0 ? EstadoReserva.EN_PROCESO : EstadoReserva.SEÑADA
    await transicionarEstado(tx, pago.reservaId, destino)
  }

  await reabrirRecordatoriosSiCorresponde(tx, pago.reservaId, reservaAntes.montoFinal, nuevoSaldo)

  const reservaFinal = await tx.reserva.findUniqueOrThrow({ where: { id: pago.reservaId } })
  return { pago, reserva: conSaldoPendiente(reservaFinal) }
}
