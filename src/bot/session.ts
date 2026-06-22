// =====================================================
// Sesión del bot — persistida en Postgres (modelo BotSesion)
// Sobrevive a reinicios del server. Una fila por número de WhatsApp.
// =====================================================
import { prisma } from '../lib/prisma'

export type EstadoBot =
  | 'INICIO'
  | 'ESPERA_DATOS_VIAJE'
  | 'BUSCANDO'
  | 'ESPERA_ELECCION'
  | 'ESPERA_DATOS_CLIENTE'
  | 'FINALIZADO'

export interface DatosViaje {
  origenNombre?: string
  destinoNombre?: string
  origenIATA?: string
  destinoIATA?: string
  fechaIda?: string
  fechaVuelta?: string
}

export interface OpcionVuelo {
  esOriginal: boolean
  etiqueta: string
  fechaIda: string
  fechaVuelta: string
  noches: number
  precio: number
  aerolinea: string
  escalas: string
  esMasBarata: boolean
}

export interface Sesion {
  from: string
  estado: EstadoBot
  datos: DatosViaje
  ultimaBusqueda?: { opciones: OpcionVuelo[]; fechaConsulta: number }
  opcionElegida?: OpcionVuelo
  historial: { role: 'user' | 'assistant'; content: string }[]
  intentosLLM: number
}

const TTL_MS = 30 * 60 * 1000 // 30 minutos sin actividad → reset

function rowASesion(r: any): Sesion {
  return {
    from: r.from,
    estado: r.estado as EstadoBot,
    datos: r.datos || {},
    ultimaBusqueda: r.ultimaBusqueda || undefined,
    opcionElegida: r.opcionElegida || undefined,
    historial: r.historial || [],
    intentosLLM: r.intentosLLM || 0,
  }
}

/**
 * Carga la sesión del usuario. Si está expirada o no existe, la crea fresca.
 */
export async function getSesion(from: string): Promise<Sesion> {
  const row = await prisma.botSesion.findUnique({ where: { from } })

  // Si está vieja, la borramos y arrancamos fresca
  if (row && Date.now() - new Date(row.modificacion).getTime() > TTL_MS) {
    await prisma.botSesion.delete({ where: { from } }).catch(() => {})
    return crearSesionInicial(from)
  }

  if (!row) return crearSesionInicial(from)

  return rowASesion(row)
}

async function crearSesionInicial(from: string): Promise<Sesion> {
  const s: Sesion = {
    from,
    estado: 'INICIO',
    datos: {},
    historial: [],
    intentosLLM: 0,
  }
  await prisma.botSesion.create({
    data: {
      from,
      estado: s.estado,
      datos: s.datos as any,
      historial: s.historial as any,
      intentosLLM: 0,
    },
  })
  return s
}

/**
 * Guarda el estado actual de la sesión.
 */
export async function guardarSesion(s: Sesion): Promise<void> {
  await prisma.botSesion.upsert({
    where: { from: s.from },
    update: {
      estado: s.estado,
      datos: s.datos as any,
      ultimaBusqueda: (s.ultimaBusqueda as any) ?? null,
      opcionElegida: (s.opcionElegida as any) ?? null,
      historial: s.historial as any,
      intentosLLM: s.intentosLLM,
    },
    create: {
      from: s.from,
      estado: s.estado,
      datos: s.datos as any,
      ultimaBusqueda: (s.ultimaBusqueda as any) ?? undefined,
      opcionElegida: (s.opcionElegida as any) ?? undefined,
      historial: s.historial as any,
      intentosLLM: s.intentosLLM,
    },
  })
}

export async function resetSesion(from: string): Promise<void> {
  await prisma.botSesion.delete({ where: { from } }).catch(() => {})
}

/** Agrega un mensaje al historial, manteniendo máximo 10 entradas. */
export function pushHistorial(
  s: Sesion,
  role: 'user' | 'assistant',
  content: string,
): void {
  s.historial.push({ role, content })
  if (s.historial.length > 10) s.historial.splice(0, s.historial.length - 10)
}
