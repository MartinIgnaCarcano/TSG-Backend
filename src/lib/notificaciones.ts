// =====================================================
// Disparo inmediato de WhatsApp + email cuando se emite un voucher o
// contrato (en vez de esperar al cron de Flujo3 — ver routes/reservas.ts,
// POST /:id/voucher y POST /:id/contrato).
//
// Es un fire-and-forget: avisa a n8n vía webhook y no espera la respuesta
// (ni la bloquea si n8n está caído o tarda) — la respuesta HTTP al front
// no debe depender de que el WhatsApp/email se haya mandado.
// =====================================================
import axios from 'axios'
import { config } from '../config'
import { logger } from './logger'

export type TipoDocumentoEmitido = 'VOUCHER' | 'CONTRATO'

export interface DocumentoEmitidoPayload {
  tipo: TipoDocumentoEmitido
  reservaId: string
  // Fase S3: URL absoluta y firmada (HMAC + vencimiento), lista para
  // mandar por WhatsApp/email tal cual — ver lib/documentos.ts.
  documentoUrl: string
}

// Hallazgo B-2 de la auditoría de ingeniería: un único intento. Si n8n
// estaba reiniciándose o el contenedor todavía no había levantado, el
// voucher se emitía igual pero el cliente no lo recibía nunca, y lo único
// que quedaba era una línea de warning que nadie mira. Tres intentos con
// espera creciente cubren la caída transitoria, que es el caso real.
//
// Contrapartida asumida: si n8n procesó el aviso pero la respuesta se
// perdió, el reintento manda el mensaje dos veces. Entre un cliente que
// recibe el voucher duplicado y uno que no lo recibe, preferimos el
// primero. Si en algún momento molesta, se cierra del lado de n8n
// descartando por `reservaId` + `tipo` ya notificados.
const REINTENTOS = 3
const ESPERA_BASE_MS = 2000

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function intentarNotificar(payload: DocumentoEmitidoPayload): Promise<void> {
  const start = process.hrtime.bigint()

  for (let intento = 1; intento <= REINTENTOS; intento++) {
    try {
      await axios.post(config.n8nWebhookDocumentoUrl, payload, { timeout: 10000 })
      const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000
      logger.info(
        {
          webhook: 'notificarDocumentoEmitido',
          tipo: payload.tipo,
          reservaId: payload.reservaId,
          url: config.n8nWebhookDocumentoUrl,
          resultado: 'ok',
          intento,
          latencyMs,
        },
        `Webhook de ${payload.tipo} emitido: n8n avisado`,
      )
      return
    } catch (e: any) {
      const esUltimo = intento === REINTENTOS

      if (!esUltimo) {
        const espera = ESPERA_BASE_MS * 2 ** (intento - 1)
        logger.warn(
          {
            webhook: 'notificarDocumentoEmitido',
            tipo: payload.tipo,
            reservaId: payload.reservaId,
            intento,
            proximoIntentoEnMs: espera,
            err: e,
          },
          `Falló el aviso a n8n (intento ${intento} de ${REINTENTOS}); se reintenta`,
        )
        await esperar(espera)
        continue
      }

      const latencyMs = Number(process.hrtime.bigint() - start) / 1_000_000
      logger.error(
        {
          webhook: 'notificarDocumentoEmitido',
          tipo: payload.tipo,
          reservaId: payload.reservaId,
          url: config.n8nWebhookDocumentoUrl,
          resultado: 'error',
          intentos: REINTENTOS,
          latencyMs,
          err: e,
        },
        `No se pudo avisar a n8n sobre el ${payload.tipo} de la reserva ${payload.reservaId} tras ${REINTENTOS} intentos. El documento se generó y se puede descargar desde el panel; lo que no salió es el envío automático de WhatsApp/email.`,
      )
    }
  }
}

/**
 * Avisa a n8n que se acaba de emitir un documento. No lanza y no bloquea:
 * la ruta que llama a esto ya generó y guardó el documento, así que su
 * respuesta HTTP no puede depender de que el aviso salga. Los reintentos
 * ocurren en segundo plano.
 */
export function notificarDocumentoEmitido(payload: DocumentoEmitidoPayload): void {
  void intentarNotificar(payload).catch((err) => {
    // Red de contención: intentarNotificar ya maneja sus errores, pero si
    // fallara el propio logger no queremos una promesa rechazada suelta
    // tumbando el proceso.
    logger.error({ err }, 'Error inesperado notificando a n8n')
  })
}
