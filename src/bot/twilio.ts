// =====================================================
// Webhook Twilio + endpoint de test sin Twilio
// =====================================================
import { Router, Request, Response } from 'express'
import { manejarMensaje } from './flow'
import { enviarMensajeWA, twilioEnabled } from './twilioClient'

const router = Router()

/**
 * Webhook que Twilio llama cuando llega un WhatsApp.
 * Twilio manda x-www-form-urlencoded con campos: From, To, Body, MessageSid…
 * Respondemos TwiML.
 * Si la respuesta del bot trae `asyncFollowUp`, devolvemos un primer mensaje
 * inmediato y mandamos el resultado real con la API de Twilio cuando termine.
 */
router.post('/twilio', async (req: Request, res: Response) => {
  try {
    const from = String(req.body.From || '').trim()
    const body = String(req.body.Body || '').trim()

    if (!from || !body) {
      res.type('text/xml').send('<Response></Response>')
      return
    }

    console.log(`[twilio] ← ${from}: ${body}`)
    const result = await manejarMensaje(from, body)
    console.log(`[twilio] → ${from}: ${result.reply.slice(0, 80)}…`)

    // Respondemos el primer mensaje vía TwiML inmediato
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXML(result.reply)}</Message>
</Response>`
    res.type('text/xml').send(xml)

    // Trabajo de fondo (búsquedas largas) — solo si tenemos credenciales Twilio
    if (result.asyncFollowUp) {
      if (!twilioEnabled) {
        console.warn(
          '[twilio] asyncFollowUp pendiente pero Twilio no está configurado — el usuario no recibirá el seguimiento',
        )
        return
      }
      setImmediate(async () => {
        try {
          const second = await result.asyncFollowUp!()
          await enviarMensajeWA(from, second)
        } catch (e: any) {
          console.error('[twilio] asyncFollowUp falló:', e)
          await enviarMensajeWA(from, `⚠️ Algo se cayó procesando: ${e.message}`)
        }
      })
    }
  } catch (e: any) {
    console.error('[twilio] error:', e)
    res.type('text/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response><Message>⚠️ Error en el bot: ${escapeXML(e.message)}</Message></Response>`,
    )
  }
})

/**
 * Endpoint de test sin Twilio.
 * Si `asyncFollowUp` existe, lo ejecuta INLINE (sincrónico) y concatena el
 * resultado al reply — así un solo round trip alcanza para validar el flujo.
 *
 * curl -X POST http://localhost:3000/api/bot/test -H "Content-Type: application/json" \
 *      -d '{"from":"whatsapp:+5492611111111","body":"hola"}'
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const from = String(req.body.from || 'whatsapp:+5492610000000').trim()
    const body = String(req.body.body || '').trim()
    if (!body) {
      res.status(400).json({ error: 'Falta el campo "body"' })
      return
    }
    const result = await manejarMensaje(from, body)
    let respuesta = result.reply
    if (result.asyncFollowUp) {
      const second = await result.asyncFollowUp()
      respuesta += '\n\n---\n\n' + second
    }
    res.json({ from, body, respuesta })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    twilio: twilioEnabled,
    groq: !!process.env.GROQ_API_KEY,
    rapidapi: !!process.env.RAPIDAPI_KEY,
    mockFlights: process.env.MOCK_FLIGHTS === 'true',
    mockLLM: process.env.MOCK_LLM === 'true',
  })
})

function escapeXML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default router
