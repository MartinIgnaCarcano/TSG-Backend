// =====================================================
// Llamadas SÍNCRONAS del back a webhooks de n8n: el back espera la
// respuesta del flujo y se la devuelve al front.
//
// Se usan para las acciones que dispara una persona desde el panel y que
// necesitan un resultado visible ("¿salió el WhatsApp?", "¿cuántos
// hoteles trajo?"). El aviso de documento emitido sigue siendo
// fire-and-forget en lib/notificaciones.ts, porque ahí el front no espera
// nada del envío.
//
// Por qué pasar por el back y no pegarle a n8n desde el navegador (como
// hacía el modal de hoteles):
//   1. El front desplegado no conoce la URL de n8n: VITE_N8N_BASE se
//      hornea en el build y por defecto era http://localhost:5678, que en
//      el navegador de otra persona no existe.
//   2. El webhook quedaba abierto a cualquiera que conociera la URL, y
//      cada llamada gasta cuota de RapidAPI o manda un WhatsApp pago.
//      Ahora el back exige sesión y le pasa a n8n la x-api-key, que el
//      flujo valida antes de hacer nada.
//   3. Un solo lugar para timeouts y mensajes de error legibles.
// =====================================================
import axios, { AxiosError } from 'axios'
import { config } from '../config'
import { logger } from './logger'

export class N8nError extends Error {
  constructor(
    message: string,
    /** Código HTTP con el que el back le responde al front. */
    public readonly status: number,
  ) {
    super(message)
    this.name = 'N8nError'
  }
}

export async function llamarWebhookN8n<T = unknown>(
  url: string,
  payload: unknown,
  opciones: { timeoutMs?: number; nombre: string },
): Promise<T> {
  const start = process.hrtime.bigint()
  try {
    const { data } = await axios.post<T>(url, payload, {
      timeout: opciones.timeoutMs ?? 30_000,
      headers: config.n8nApiKey ? { 'x-api-key': config.n8nApiKey } : undefined,
    })
    logger.info(
      { webhook: opciones.nombre, url, latencyMs: Number(process.hrtime.bigint() - start) / 1e6 },
      `n8n respondió (${opciones.nombre})`,
    )
    return data
  } catch (e) {
    const err = e as AxiosError<{ message?: string; error?: string }>
    const latencyMs = Number(process.hrtime.bigint() - start) / 1e6
    logger.error({ webhook: opciones.nombre, url, latencyMs, err }, `Falló la llamada a n8n (${opciones.nombre})`)

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      throw new N8nError('n8n tardó demasiado en responder. Probá de nuevo en un momento.', 504)
    }
    if (!err.response) {
      throw new N8nError(
        'No se pudo contactar a n8n. Verificá que el servicio esté levantado y que la URL del webhook sea correcta.',
        502,
      )
    }
    if (err.response.status === 404) {
      // Es lo que devuelve n8n cuando el workflow está importado pero apagado.
      throw new N8nError(`El flujo de n8n (${opciones.nombre}) no está activo. Activalo con el toggle en n8n.`, 502)
    }
    const detalle = err.response.data?.message || err.response.data?.error
    throw new N8nError(
      `El flujo de n8n (${opciones.nombre}) falló${detalle ? `: ${detalle}` : ''}. Revisá la ejecución en n8n.`,
      502,
    )
  }
}
