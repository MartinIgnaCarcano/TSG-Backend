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

export type TipoDocumentoEmitido = 'VOUCHER' | 'CONTRATO'

export interface DocumentoEmitidoPayload {
  tipo: TipoDocumentoEmitido
  reservaId: string
  // Fase S3: URL absoluta y firmada (HMAC + vencimiento), lista para
  // mandar por WhatsApp/email tal cual — ver lib/documentos.ts.
  documentoUrl: string
}

/**
 * Avisa a n8n que se acaba de emitir un documento. No lanza si falla — solo
 * loguea una advertencia, para no romper la respuesta de la ruta que llama
 * a esto (el documento ya se generó y guardó igual).
 */
export function notificarDocumentoEmitido(payload: DocumentoEmitidoPayload): void {
  axios
    .post(config.n8nWebhookDocumentoUrl, payload, { timeout: 10000 })
    .catch((e: any) => {
      console.warn(
        `⚠️  No se pudo avisar a n8n (${config.n8nWebhookDocumentoUrl}) sobre el ${payload.tipo} de la reserva ${payload.reservaId}: ${e.message}. El documento se generó igual; el envío automático de WhatsApp/email no se disparó.`,
      )
    })
}
