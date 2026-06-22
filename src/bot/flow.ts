// =====================================================
// Máquina de estados del bot — versión con persistencia
// El bot deja la Cotización en estado PENDIENTE; el vendedor
// la confirma desde el front y ahí se crea la Reserva.
// =====================================================
import { prisma } from '../lib/prisma'
import {
  getSesion,
  guardarSesion,
  resetSesion,
  pushHistorial,
  Sesion,
} from './session'
import { procesarMensaje } from './llm'
import { buscarComparativa, formatearComparativa } from './flights'

/**
 * Resultado del bot:
 *   - reply: texto a devolver al instante (TwiML / JSON)
 *   - asyncFollowUp: si está presente, se ejecuta DESPUÉS de responder y
 *     manda un segundo mensaje al usuario por la API de Twilio. Útil para
 *     búsquedas largas (Google Flights tarda ~15s).
 */
export interface BotResult {
  reply: string
  asyncFollowUp?: () => Promise<string>
}

export async function manejarMensaje(from: string, texto: string): Promise<BotResult> {
  const limpio = texto.trim()

  // Comando global de reset
  if (/^(reset|reiniciar|empezar|nuevo)$/i.test(limpio)) {
    await resetSesion(from)
    return { reply: '🔄 Conversación reiniciada. Contame: ¿desde dónde y hacia dónde querés volar?' }
  }

  const s = await getSesion(from)
  pushHistorial(s, 'user', limpio)

  try {
    let result: BotResult
    switch (s.estado) {
      case 'INICIO':
      case 'ESPERA_DATOS_VIAJE':
      case 'FINALIZADO':
        result = await pasoLLM(s, limpio)
        break
      case 'ESPERA_ELECCION':
        result = { reply: await pasoEleccion(s, limpio) }
        break
      case 'BUSCANDO':
        result = { reply: '⏳ Ya estoy buscando, dame unos segundos…' }
        break
      default:
        result = { reply: 'No te entendí. Mandá "reset" para empezar de nuevo.' }
    }

    pushHistorial(s, 'assistant', result.reply)
    await guardarSesion(s)
    return result
  } catch (e: any) {
    console.error('[bot] error inesperado:', e)
    return { reply: `⚠️ Algo falló: ${e.message}\nMandá "reset" para empezar de nuevo.` }
  }
}

// ------------------- PASO 1: LLM extrae datos del viaje -------------------
async function pasoLLM(s: Sesion, texto: string): Promise<BotResult> {
  s.estado = 'ESPERA_DATOS_VIAJE'

  const historial = s.historial.slice(0, -1)
  const r = await procesarMensaje(historial, texto)

  if (!r.completo) {
    s.intentosLLM += 1
    return {
      reply:
        r.respuesta ||
        '🤔 No te entendí. Decime origen, destino y fechas. Ej: "MDZ a MIA del 2026-07-10 al 2026-07-20"',
    }
  }

  // Datos completos → arrancamos búsqueda. Mensaje inmediato + búsqueda async.
  s.datos = r.datos!
  s.estado = 'BUSCANDO'

  const aviso =
    `⏳ *Buscando vuelos…*\n\n` +
    `✈️ ${s.datos.origenNombre} (${s.datos.origenIATA}) → ${s.datos.destinoNombre} (${s.datos.destinoIATA})\n` +
    `📅 ${s.datos.fechaIda} → ${s.datos.fechaVuelta}\n\n` +
    `Estoy comparando 5 fechas alrededor de las tuyas, tarda ~15 segundos.`

  // Guardamos los datos para que asyncFollowUp pueda usarlos
  const datosBusqueda = { ...s.datos }
  const fromCapturado = s.from

  return {
    reply: aviso,
    asyncFollowUp: async () => {
      try {
        const opciones = await buscarComparativa({
          origenIATA: datosBusqueda.origenIATA!,
          destinoIATA: datosBusqueda.destinoIATA!,
          fechaIda: datosBusqueda.fechaIda!,
          fechaVuelta: datosBusqueda.fechaVuelta!,
        })

        // Recargamos la sesión para no pisar cambios que pudieron ocurrir
        const sActual = await getSesion(fromCapturado)

        if (opciones.length === 0) {
          sActual.estado = 'ESPERA_DATOS_VIAJE'
          sActual.datos = {}
          await guardarSesion(sActual)
          return `😕 No encontré vuelos para ${datosBusqueda.origenIATA}→${datosBusqueda.destinoIATA} en esas fechas.\n\nProbá con otras fechas o destino.`
        }

        sActual.ultimaBusqueda = { opciones, fechaConsulta: Date.now() }
        sActual.estado = 'ESPERA_ELECCION'
        await guardarSesion(sActual)

        return formatearComparativa(
          datosBusqueda.origenNombre || datosBusqueda.origenIATA!,
          datosBusqueda.destinoNombre || datosBusqueda.destinoIATA!,
          opciones,
        )
      } catch (e: any) {
        console.error('[bot] error en búsqueda async:', e)
        const sActual = await getSesion(fromCapturado)
        sActual.estado = 'ESPERA_DATOS_VIAJE'
        await guardarSesion(sActual)
        return `⚠️ Se cayó la búsqueda: ${e.message}\nMandá las fechas de nuevo o probá "reset".`
      }
    },
  }
}

// ------------------- PASO 2: usuario eligió opción + datos cliente -------------------
async function pasoEleccion(s: Sesion, texto: string): Promise<string> {
  const partes = texto.split('|').map((p) => p.trim())
  if (partes.length < 3) {
    return (
      '❌ Formato inválido.\n\nPor favor mandá:\n' +
      '`NUMERO | Nombre Apellido | email`\n\n' +
      'Ejemplo: `1 | Juan Perez | juan@mail.com`'
    )
  }
  const [numStr, nombreCompleto, email] = partes
  const num = parseInt(numStr, 10)
  const opciones = s.ultimaBusqueda?.opciones || []

  if (isNaN(num) || num < 1 || num > opciones.length) {
    return `❌ Número inválido. Tiene que ser entre 1 y ${opciones.length}.`
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return `❌ Email inválido: ${email}`
  }
  const partesNombre = nombreCompleto.split(/\s+/)
  if (partesNombre.length < 2) {
    return '❌ Mandá nombre y apellido completos.'
  }
  const apellido = partesNombre.pop()!
  const nombre = partesNombre.join(' ')

  s.opcionElegida = opciones[num - 1]

  const resumen = await crearCotizacionPendiente(s, { nombre, apellido, email })
  s.estado = 'FINALIZADO'
  return resumen
}

// ------------------- Persistencia: Cliente + Viaje + Cotización PENDIENTE -------------------
async function crearCotizacionPendiente(
  s: Sesion,
  cli: { nombre: string; apellido: string; email: string },
): Promise<string> {
  const opt = s.opcionElegida!
  const d = s.datos

  // 1) Destinos (upsert por IATA)
  const origen = await prisma.destino.upsert({
    where: { codigoIATA: d.origenIATA! },
    update: {},
    create: {
      codigoIATA: d.origenIATA!,
      nombre: d.origenNombre || d.origenIATA!,
      pais: 'Desconocido',
    },
  })
  const destino = await prisma.destino.upsert({
    where: { codigoIATA: d.destinoIATA! },
    update: {},
    create: {
      codigoIATA: d.destinoIATA!,
      nombre: d.destinoNombre || d.destinoIATA!,
      pais: 'Desconocido',
    },
  })

  // 2) Cliente — buscar por email; si no existe, crear
  let cliente = await prisma.cliente.findFirst({
    where: { email: cli.email, baja: null },
  })
  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: {
        nombre: cli.nombre,
        apellido: cli.apellido,
        email: cli.email,
        telefono: s.from.replace('whatsapp:', ''),
        numeroCliente: `CLI-${Date.now()}`,
      },
    })
  }

  // 3) Viaje + tramos (ida y vuelta)
  const viaje = await prisma.viaje.create({
    data: {
      origenId: origen.id,
      destinoId: destino.id,
      tieneEscalas: opt.escalas !== 'Directo ✅',
      descripcion: `${origen.codigoIATA} → ${destino.codigoIATA} (${opt.aerolinea})`,
      tramos: {
        create: [
          {
            origenId: origen.id,
            destinoId: destino.id,
            orden: 1,
            aerolinea: opt.aerolinea,
            horaSalida: new Date(opt.fechaIda + 'T08:00:00Z'),
            horaLlegada: new Date(opt.fechaIda + 'T20:00:00Z'),
            completo: false,
          },
          {
            origenId: destino.id,
            destinoId: origen.id,
            orden: 2,
            aerolinea: opt.aerolinea,
            horaSalida: new Date(opt.fechaVuelta + 'T08:00:00Z'),
            horaLlegada: new Date(opt.fechaVuelta + 'T20:00:00Z'),
            completo: false,
          },
        ],
      },
    },
  })

  // 4) Cotización en estado PENDIENTE (el vendedor confirma desde el front)
  const cotizacion = await prisma.cotizacion.create({
    data: {
      numeroCotizacion: `COT-${Date.now()}`,
      viajeId: viaje.id,
      clienteId: cliente.id,
      estado: 'PENDIENTE',
      fechaVencimiento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      moneda: 'USD',
      precioIda: Math.round(opt.precio * 0.5),
      precioVuelta: Math.round(opt.precio * 0.5),
      precioIdaYVuelta: opt.precio,
      impuestos: Math.round(opt.precio * 0.21),
      observaciones: `Generada por bot WhatsApp — ${opt.aerolinea} — ${opt.escalas}`,
      ofertaExternaID: `BOT-${Date.now()}`,
    },
  })

  return (
    `✅ *¡Cotización lista!*\n\n` +
    `📋 Número: \`${cotizacion.numeroCotizacion}\`\n` +
    `👤 Cliente: ${cli.nombre} ${cli.apellido}\n` +
    `✈️ ${origen.codigoIATA} → ${destino.codigoIATA}\n` +
    `📅 ${opt.fechaIda} → ${opt.fechaVuelta}\n` +
    `🏢 ${opt.aerolinea}\n` +
    `💰 Total estimado: USD ${Math.round(opt.precio * 1.21)} (impuestos incluidos)\n\n` +
    `Quedó *reservada por 7 días*. Un asesor de STG te contacta en breve para confirmar la reserva y los pagos. 👋\n\n` +
    `_Para una nueva consulta mandá "reset"._`
  )
}
