// =====================================================
// Cliente Twilio — envía mensajes fuera del flujo de respuesta
// del webhook (para los "status updates" durante búsquedas largas).
// Si las credenciales no están configuradas, todas las funciones
// quedan no-op y el flujo cae a modo síncrono.
// =====================================================
import twilio from 'twilio'

const SID = process.env.TWILIO_ACCOUNT_SID
const TOKEN = process.env.TWILIO_AUTH_TOKEN
const FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

let client: ReturnType<typeof twilio> | null = null
try {
  if (SID && TOKEN && SID.startsWith('AC')) {
    client = twilio(SID, TOKEN)
  }
} catch (e: any) {
  console.warn('[twilio] cliente no inicializado:', e.message)
}

export const twilioEnabled = !!client

export async function enviarMensajeWA(to: string, body: string): Promise<void> {
  if (!client) {
    console.warn('[twilio] no configurado, no se envía mensaje async')
    return
  }
  try {
    const r = await client.messages.create({ from: FROM, to, body })
    console.log(`[twilio] ✓ enviado ${r.sid} a ${to}`)
  } catch (e: any) {
    console.error(`[twilio] error enviando a ${to}:`, e.message)
  }
}
