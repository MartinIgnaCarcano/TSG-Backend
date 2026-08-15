// =====================================================
// Tests de src/services/reservas.service.ts (Fase S2 del plan de
// seguridad y robustez). Dos grupos:
//  - lógica pura (sin DB): TRANSICIONES_VALIDAS, calcularSaldoPendiente,
//    construirRecordatorios.
//  - lógica con efectos (transicionarEstado, registrarPago) usando un
//    mock manual del cliente Prisma — ambas funciones reciben `db`/`tx`
//    por parámetro (dependency injection), así que las funciones en sí
//    no tocan una base real.
//
// reservas.service.ts importa igual el singleton real de '../lib/prisma'
// a nivel de módulo (lo usa inferirFechasViaje, que no testeamos acá).
// Se mockea ese módulo para que el import no intente instanciar un
// PrismaClient real ni buscar el query engine nativo — así los tests
// corren sin DB y sin depender del entorno (Windows/Linux) donde se
// generó el client.
// =====================================================
import { describe, it, expect, vi } from 'vitest'
import { EstadoReserva, Prisma, TipoRecordatorio } from '@prisma/client'

vi.mock('../lib/prisma', () => ({ prisma: {} }))

import {
  TRANSICIONES_VALIDAS,
  TransicionInvalidaError,
  transicionarEstado,
  calcularSaldoPendiente,
  construirRecordatorios,
  registrarPago,
  anularPago,
} from './reservas.service'

// =====================================================
// TRANSICIONES_VALIDAS — lógica pura
// =====================================================
describe('TRANSICIONES_VALIDAS', () => {
  it('EN_PROCESO permite pasar a SEÑADA, PAGADA o CANCELADA', () => {
    expect(TRANSICIONES_VALIDAS.EN_PROCESO).toContain(EstadoReserva.SEÑADA)
    expect(TRANSICIONES_VALIDAS.EN_PROCESO).toContain(EstadoReserva.PAGADA)
    expect(TRANSICIONES_VALIDAS.EN_PROCESO).toContain(EstadoReserva.CANCELADA)
  })

  it('EN_PROCESO NO permite saltar directo a DOCUMENTADA', () => {
    expect(TRANSICIONES_VALIDAS.EN_PROCESO).not.toContain(EstadoReserva.DOCUMENTADA)
  })

  it('SEÑADA permite pasar a PAGADA o CANCELADA', () => {
    expect(TRANSICIONES_VALIDAS.SEÑADA).toContain(EstadoReserva.PAGADA)
    expect(TRANSICIONES_VALIDAS.SEÑADA).toContain(EstadoReserva.CANCELADA)
  })

  it('PAGADA permite pasar a DOCUMENTADA o CANCELADA', () => {
    expect(TRANSICIONES_VALIDAS.PAGADA).toEqual(
      expect.arrayContaining([EstadoReserva.DOCUMENTADA, EstadoReserva.CANCELADA]),
    )
  })

  it('PAGADA permite volver a SEÑADA o EN_PROCESO (Fase S5, solo por anulación de pago)', () => {
    expect(TRANSICIONES_VALIDAS.PAGADA).toEqual(
      expect.arrayContaining([EstadoReserva.SEÑADA, EstadoReserva.EN_PROCESO]),
    )
  })

  it('DOCUMENTADA permite pasar a EN_VIAJE o CANCELADA', () => {
    expect(TRANSICIONES_VALIDAS.DOCUMENTADA).toEqual(
      expect.arrayContaining([EstadoReserva.EN_VIAJE, EstadoReserva.CANCELADA]),
    )
  })

  it('EN_VIAJE permite pasar a FINALIZADA o CANCELADA', () => {
    expect(TRANSICIONES_VALIDAS.EN_VIAJE).toEqual(
      expect.arrayContaining([EstadoReserva.FINALIZADA, EstadoReserva.CANCELADA]),
    )
  })

  it('FINALIZADA es terminal: no permite pasar a ningún otro estado', () => {
    expect(TRANSICIONES_VALIDAS.FINALIZADA).toEqual([])
  })

  it('CANCELADA es terminal: no permite pasar a ningún otro estado', () => {
    expect(TRANSICIONES_VALIDAS.CANCELADA).toEqual([])
  })
})

// =====================================================
// calcularSaldoPendiente — lógica pura
// =====================================================
describe('calcularSaldoPendiente', () => {
  it('caso normal: monto final mayor al saldo pagado', () => {
    expect(calcularSaldoPendiente(1000, 400)).toBe(600)
  })

  it('saldo exacto: pagado cubre exactamente el monto final', () => {
    expect(calcularSaldoPendiente(1000, 1000)).toBe(0)
  })

  it('sobrepago: saldo pagado supera el monto final (resultado negativo)', () => {
    expect(calcularSaldoPendiente(1000, 1200)).toBe(-200)
  })

  it('acepta montos como string', () => {
    expect(calcularSaldoPendiente('1000.50', '400.50')).toBe(600)
  })

  it('acepta montos como Prisma.Decimal', () => {
    const montoFinal = new Prisma.Decimal('1500.75')
    const saldoPagado = new Prisma.Decimal('500.25')
    expect(calcularSaldoPendiente(montoFinal, saldoPagado)).toBe(1000.5)
  })
})

// =====================================================
// construirRecordatorios — lógica pura
// =====================================================
describe('construirRecordatorios', () => {
  it('sin fechaViaje no genera ningún recordatorio', () => {
    const recordatorios = construirRecordatorios('r1', 1000, 0, undefined, undefined)
    expect(recordatorios).toEqual([])
  })

  // El reloj se fija porque construirRecordatorios adelanta a "ahora" toda
  // fecha de PAGO_SALDO que ya haya pasado (clamp de la Fase M7). Sin fijar
  // el reloj, el test aprueba hasta el 18/7/2026 y falla a partir de esa
  // fecha, que es lo que ocurría antes de este cambio.
  it('con fechaViaje y saldo pendiente genera PAGO_SALDO (14 días antes) y CHECK_IN (1 día antes)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'))
    try {
      const fViaje = new Date('2026-08-01T00:00:00.000Z')
      const recordatorios = construirRecordatorios('r1', 1000, 0, fViaje, undefined)

      const pagoSaldo = recordatorios.find((r) => r.tipo === TipoRecordatorio.PAGO_SALDO)
      const checkIn = recordatorios.find((r) => r.tipo === TipoRecordatorio.CHECK_IN)

      expect(pagoSaldo).toBeDefined()
      expect(pagoSaldo!.fechaProgramada).toEqual(new Date('2026-07-18T00:00:00.000Z'))
      expect(checkIn).toBeDefined()
      expect(checkIn!.fechaProgramada).toEqual(new Date('2026-07-31T00:00:00.000Z'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('adelanta PAGO_SALDO a "ahora" si los 14 días previos ya pasaron (clamp de la Fase M7)', () => {
    vi.useFakeTimers()
    const ahora = new Date('2026-07-25T10:00:00.000Z')
    vi.setSystemTime(ahora)
    try {
      // Viaje en 7 días: "14 días antes" cae en el pasado.
      const fViaje = new Date('2026-08-01T00:00:00.000Z')
      const recordatorios = construirRecordatorios('r1', 1000, 0, fViaje, undefined)
      const pagoSaldo = recordatorios.find((r) => r.tipo === TipoRecordatorio.PAGO_SALDO)

      expect(pagoSaldo).toBeDefined()
      expect(pagoSaldo!.fechaProgramada).toEqual(ahora)
    } finally {
      vi.useRealTimers()
    }
  })

  it('sin saldo pendiente (reserva ya pagada) NO genera PAGO_SALDO', () => {
    const fViaje = new Date('2026-08-01T00:00:00.000Z')
    const recordatorios = construirRecordatorios('r1', 1000, 1000, fViaje, undefined)
    expect(recordatorios.find((r) => r.tipo === TipoRecordatorio.PAGO_SALDO)).toBeUndefined()
    // CHECK_IN se genera siempre que haya fechaViaje, tenga o no saldo pendiente
    expect(recordatorios.find((r) => r.tipo === TipoRecordatorio.CHECK_IN)).toBeDefined()
  })

  it('con fechaRegreso genera POST_VIAJE (1 día después)', () => {
    const fViaje = new Date('2026-08-01T00:00:00.000Z')
    const fRegreso = new Date('2026-08-10T00:00:00.000Z')
    const recordatorios = construirRecordatorios('r1', 1000, 0, fViaje, fRegreso)
    const postViaje = recordatorios.find((r) => r.tipo === TipoRecordatorio.POST_VIAJE)
    expect(postViaje).toBeDefined()
    expect(postViaje!.fechaProgramada).toEqual(new Date('2026-08-11T00:00:00.000Z'))
  })

  it('sin fechaRegreso NO genera POST_VIAJE', () => {
    const fViaje = new Date('2026-08-01T00:00:00.000Z')
    const recordatorios = construirRecordatorios('r1', 1000, 0, fViaje, undefined)
    expect(recordatorios.find((r) => r.tipo === TipoRecordatorio.POST_VIAJE)).toBeUndefined()
  })

  it('reserva creada a menos de 14 días del viaje: PAGO_SALDO se programa para "hoy" (Fase M7), no queda con fecha pasada', () => {
    // Antes (Fase S2) construirRecordatorios no comparaba fViaje-14 contra
    // "ahora": el cálculo daba una fecha pasada y se dejaba así, confiando
    // en que el cron de Flujo3 ("fechaProgramada <= ahora") lo levantara en
    // su próximo tick. Fase M7 hace el comportamiento explícito: si
    // fViaje-14d < ahora, se clampea a "ahora".
    const fViaje = new Date(Date.now() + 5 * 86400000) // viaje en 5 días → fViaje-14d cae en el pasado
    const antes = Date.now()
    const recordatorios = construirRecordatorios('r1', 1000, 0, fViaje, undefined)
    const despues = Date.now()
    const pagoSaldo = recordatorios.find((r) => r.tipo === TipoRecordatorio.PAGO_SALDO)

    expect(pagoSaldo).toBeDefined()
    // No queda en el pasado: cae entre el instante justo antes y justo
    // después de llamar a la función (clampeado a "ahora").
    expect(pagoSaldo!.fechaProgramada.getTime()).toBeGreaterThanOrEqual(antes)
    expect(pagoSaldo!.fechaProgramada.getTime()).toBeLessThanOrEqual(despues)
  })
})

// =====================================================
// transicionarEstado — con mock manual del cliente Prisma
// =====================================================
describe('transicionarEstado (mock Prisma)', () => {
  it('transición válida hace updateMany condicionado al estado leído y releé la reserva', async () => {
    const db = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', estado: EstadoReserva.EN_PROCESO }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'r1', estado: EstadoReserva.SEÑADA }),
      },
    } as any

    const result = await transicionarEstado(db, 'r1', EstadoReserva.SEÑADA)

    expect(db.reserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', estado: EstadoReserva.EN_PROCESO },
      data: { estado: EstadoReserva.SEÑADA },
    })
    expect(db.reserva.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'r1' } })
    expect(result.estado).toBe(EstadoReserva.SEÑADA)
  })

  it('transición inválida lanza TransicionInvalidaError y no escribe en DB', async () => {
    const db = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', estado: EstadoReserva.EN_PROCESO }),
        updateMany: vi.fn(),
      },
    } as any

    await expect(transicionarEstado(db, 'r1', EstadoReserva.DOCUMENTADA)).rejects.toBeInstanceOf(
      TransicionInvalidaError,
    )
    expect(db.reserva.updateMany).not.toHaveBeenCalled()
  })

  it('no-op si la reserva ya está en el estado destino (no escribe en DB)', async () => {
    const actual = { id: 'r1', estado: EstadoReserva.SEÑADA }
    const db = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue(actual),
        updateMany: vi.fn(),
      },
    } as any

    const result = await transicionarEstado(db, 'r1', EstadoReserva.SEÑADA)

    expect(result).toBe(actual)
    expect(db.reserva.updateMany).not.toHaveBeenCalled()
  })

  it('lanza si la reserva no existe', async () => {
    const db = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
      },
    } as any

    await expect(transicionarEstado(db, 'no-existe', EstadoReserva.SEÑADA)).rejects.toThrow(
      'Reserva no encontrada',
    )
  })

  // Fase S4: TOCTOU fix. Simula dos transiciones concurrentes sobre la
  // misma reserva — el findUnique lee un estado que todavía permite la
  // transición pedida, pero para cuando llega el updateMany otro proceso
  // ya movió la fila a otro estado (o la misma transición ya se aplicó):
  // el where condicionado no matchea ninguna fila (count 0) y se trata
  // como transición inválida en vez de pisar el cambio del otro proceso.
  it('transiciones concurrentes: si el updateMany afecta 0 filas, lanza TransicionInvalidaError sin releer la reserva', async () => {
    const db = {
      reserva: {
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', estado: EstadoReserva.EN_PROCESO }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
    } as any

    await expect(transicionarEstado(db, 'r1', EstadoReserva.SEÑADA)).rejects.toBeInstanceOf(
      TransicionInvalidaError,
    )
    expect(db.reserva.findUniqueOrThrow).not.toHaveBeenCalled()
  })
})

// =====================================================
// registrarPago — con mock manual del cliente Prisma (tx)
// =====================================================
describe('registrarPago (mock Prisma)', () => {
  it('pago que cubre el total avanza la reserva a PAGADA y cierra recordatorios de saldo', async () => {
    // Reserva EN_PROCESO, montoFinal 1000, saldoPagado previo 800.
    // Pago de 200 cubre el total -> saldoPagado 1000, pendiente 0.
    const tx = {
      pago: {
        create: vi.fn().mockResolvedValue({ id: 'p1', reservaId: 'r1', monto: 200 }),
      },
      reserva: {
        // Único update directo: el increment del saldoPagado tras crear el
        // pago. El avance a PAGADA ahora pasa por transicionarEstado, que
        // usa updateMany (Fase S4) en vez de un 2do update.
        update: vi.fn().mockResolvedValue({
          id: 'r1',
          estado: EstadoReserva.EN_PROCESO,
          montoFinal: 1000,
          saldoPagado: 1000,
        }),
        // Lectura interna de transicionarEstado: la reserva ya está
        // EN_PROCESO con el saldo actualizado (post-increment).
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', estado: EstadoReserva.EN_PROCESO }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'r1',
          estado: EstadoReserva.PAGADA,
          montoFinal: 1000,
          saldoPagado: 1000,
        }),
      },
      recordatorio: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any

    const { pago, reserva } = await registrarPago(tx, 'r1', { monto: 200 })

    expect(pago.id).toBe('p1')
    expect(reserva.estado).toBe(EstadoReserva.PAGADA)
    expect(tx.reserva.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { saldoPagado: { increment: 200 } },
    })
    expect(tx.reserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', estado: EstadoReserva.EN_PROCESO },
      data: { estado: EstadoReserva.PAGADA },
    })
    expect(tx.recordatorio.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ reservaId: 'r1', tipo: TipoRecordatorio.PAGO_SALDO }) }),
    )
  })

  it('pago parcial NO avanza la reserva a PAGADA (queda en SEÑADA, sin cerrar recordatorios)', async () => {
    // Reserva ya SEÑADA, montoFinal 1000, saldoPagado previo 300.
    // Pago parcial de 200 -> saldoPagado 500, pendiente 500 (> 0):
    // no debe avanzar de estado ni cerrar recordatorios de PAGO_SALDO.
    // (El pasaje EN_PROCESO->SEÑADA es un paso manual vía POST /confirmar,
    // no algo que dispare registrarPago según el monto pagado.)
    const tx = {
      pago: {
        create: vi.fn().mockResolvedValue({ id: 'p2', reservaId: 'r1', monto: 200 }),
      },
      reserva: {
        update: vi.fn().mockResolvedValue({
          id: 'r1',
          estado: EstadoReserva.SEÑADA,
          montoFinal: 1000,
          saldoPagado: 500,
        }),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'r1',
          estado: EstadoReserva.SEÑADA,
          montoFinal: 1000,
          saldoPagado: 500,
        }),
      },
      recordatorio: {
        updateMany: vi.fn(),
      },
    } as any

    const { reserva } = await registrarPago(tx, 'r1', { monto: 200 })

    expect(reserva.estado).toBe(EstadoReserva.SEÑADA)
    expect(tx.recordatorio.updateMany).not.toHaveBeenCalled()
    // Solo el update del increment; no hay una 2da llamada de transicionarEstado
    expect(tx.reserva.update).toHaveBeenCalledTimes(1)
    expect(tx.reserva.findUnique).not.toHaveBeenCalled()
  })
})

// =====================================================
// anularPago — con mock manual del cliente Prisma (tx). Fase S5: anular un
// pago debe reconciliar saldoPagado y, si corresponde, revertir el estado.
// =====================================================
describe('anularPago (mock Prisma)', () => {
  it('devuelve null si el pago no existe', async () => {
    const tx = {
      pago: { findUnique: vi.fn().mockResolvedValue(null) },
    } as any

    const resultado = await anularPago(tx, 'no-existe')
    expect(resultado).toBeNull()
  })

  it('anular el pago que completaba la reserva la devuelve a SEÑADA con saldo correcto', async () => {
    // Reserva PAGADA (montoFinal 1000, saldoPagado 1000, dos pagos de 600+400).
    // Se anula el de 400 -> queda un pago activo de 600 -> saldo pendiente 400 (>0, pero >0 no cubre):
    // debe volver a SEÑADA, no a EN_PROCESO (todavía queda saldo pagado > 0).
    const tx = {
      pago: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p2', reservaId: 'r1', monto: 400, baja: null }),
        update: vi.fn().mockResolvedValue({ id: 'p2', reservaId: 'r1', monto: 400, baja: new Date() }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 600 } }),
      },
      reserva: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ id: 'r1', estado: EstadoReserva.PAGADA, montoFinal: 1000, saldoPagado: 1000 }) // reservaAntes
          // Después: releída dos veces más (1. dentro de transicionarEstado, al
          // volver a SEÑADA; 2. reservaFinal al final de anularPago). Mismo estado
          // final en ambas, por eso alcanza con mockResolvedValue (no Once).
          .mockResolvedValue({ id: 'r1', estado: EstadoReserva.SEÑADA, montoFinal: 1000, saldoPagado: 600 }),
        update: vi.fn().mockResolvedValue({ id: 'r1' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', estado: EstadoReserva.PAGADA }), // lectura interna de transicionarEstado
        updateMany: vi.fn().mockResolvedValue({ count: 1 }), // updateMany interno de transicionarEstado
      },
      recordatorio: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any

    const resultado = await anularPago(tx, 'p2')

    expect(resultado).not.toBeNull()
    expect(resultado!.reserva.estado).toBe(EstadoReserva.SEÑADA)
    expect(resultado!.reserva.saldoPendiente).toBe(400)
    expect(tx.reserva.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { saldoPagado: 600 } })
    expect(tx.reserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', estado: EstadoReserva.PAGADA },
      data: { estado: EstadoReserva.SEÑADA },
    })
    expect(tx.recordatorio.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ reservaId: 'r1', tipo: TipoRecordatorio.PAGO_SALDO, ejecutado: true }),
      }),
    )
  })

  it('anular el único pago de una reserva PAGADA la devuelve a EN_PROCESO (saldo en 0)', async () => {
    const tx = {
      pago: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p1', reservaId: 'r1', monto: 1000, baja: null }),
        update: vi.fn().mockResolvedValue({ id: 'p1', reservaId: 'r1', monto: 1000, baja: new Date() }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: null } }), // no quedan pagos activos
      },
      reserva: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ id: 'r1', estado: EstadoReserva.PAGADA, montoFinal: 1000, saldoPagado: 1000 })
          .mockResolvedValue({ id: 'r1', estado: EstadoReserva.EN_PROCESO, montoFinal: 1000, saldoPagado: 0 }),
        update: vi.fn().mockResolvedValue({ id: 'r1' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'r1', estado: EstadoReserva.PAGADA }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      recordatorio: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any

    const resultado = await anularPago(tx, 'p1')

    expect(resultado!.reserva.estado).toBe(EstadoReserva.EN_PROCESO)
    expect(tx.reserva.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', estado: EstadoReserva.PAGADA },
      data: { estado: EstadoReserva.EN_PROCESO },
    })
  })

  it('anular un pago de una reserva que ya no está PAGADA (ej. DOCUMENTADA) no revierte el estado, solo recalcula el saldo', async () => {
    const tx = {
      pago: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p2', reservaId: 'r1', monto: 400, baja: null }),
        update: vi.fn().mockResolvedValue({ id: 'p2', reservaId: 'r1', monto: 400, baja: new Date() }),
        aggregate: vi.fn().mockResolvedValue({ _sum: { monto: 600 } }),
      },
      reserva: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ id: 'r1', estado: EstadoReserva.DOCUMENTADA, montoFinal: 1000, saldoPagado: 1000 })
          .mockResolvedValueOnce({ id: 'r1', estado: EstadoReserva.DOCUMENTADA, montoFinal: 1000, saldoPagado: 600 }),
        update: vi.fn().mockResolvedValue({ id: 'r1' }),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      recordatorio: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as any

    const resultado = await anularPago(tx, 'p2')

    expect(resultado!.reserva.estado).toBe(EstadoReserva.DOCUMENTADA)
    expect(tx.reserva.updateMany).not.toHaveBeenCalled() // no se intenta ninguna transición
    expect(tx.reserva.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { saldoPagado: 600 } })
    // el recordatorio se reabre igual: hay saldo pendiente (400), independientemente del estado
    expect(tx.recordatorio.updateMany).toHaveBeenCalled()
  })

  it('anular un pago ya anulado es no-op: no recalcula saldo ni revierte estado', async () => {
    const tx = {
      pago: {
        findUnique: vi.fn().mockResolvedValue({ id: 'p2', reservaId: 'r1', monto: 400, baja: new Date('2026-01-01') }),
        update: vi.fn(),
        aggregate: vi.fn(),
      },
      reserva: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'r1', estado: EstadoReserva.SEÑADA, montoFinal: 1000, saldoPagado: 600 }),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      recordatorio: { updateMany: vi.fn() },
    } as any

    const resultado = await anularPago(tx, 'p2')

    expect(resultado!.reserva.estado).toBe(EstadoReserva.SEÑADA)
    expect(tx.pago.update).not.toHaveBeenCalled()
    expect(tx.reserva.update).not.toHaveBeenCalled()
    expect(tx.recordatorio.updateMany).not.toHaveBeenCalled()
  })
})
