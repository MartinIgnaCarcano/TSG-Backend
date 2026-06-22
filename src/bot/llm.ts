// =====================================================
// LLM (Groq) — extrae origen, destino, fechas IATA del mensaje
// Si MOCK_LLM=true o no hay GROQ_API_KEY, cae a un parser regex simple.
// Con retries y backoff exponencial.
// =====================================================
import Groq from 'groq-sdk'
import { DatosViaje } from './session'
import { withRetry, isHttpRetriable } from './retry'

const MOCK = process.env.MOCK_LLM === 'true' || !process.env.GROQ_API_KEY
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

const groq = MOCK ? null : new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `Sos el asistente virtual de ventas de Smart Booking STG.
Hablás en español rioplatense, sos amable y cálido (podés usar modismos sutiles tipo "dale", "perfecto").
Tu objetivo es recopilar 4 datos OBLIGATORIOS del cliente:
1. Origen (ciudad)
2. Destino (ciudad)
3. Fecha de ida
4. Fecha de vuelta

LÓGICA DE RESPUESTA (¡ESTRICTA!):

ESCENARIO 1 — Faltan datos:
Si en el último mensaje + el historial NO están los 4 datos completos, respondé como un humano.
Confirmá los datos que ya tenés ("perfecto, anoto Mendoza como origen") y preguntá amablemente SOLO por los que faltan.
NO uses JSON. Solo texto natural, corto.

ESCENARIO 2 — Tenés los 4 datos:
Cuando ya tenés origen + destino + ida + vuelta, cambiá a MODO MÁQUINA.
NO saludes, NO comentes, NO agregues texto extra.
Tu ÚNICA salida debe ser un objeto JSON crudo con esta estructura exacta:

{
"origenNombre": "Ciudad de origen",
"destinoNombre": "Ciudad de destino",
"origenIATA": "XXX",
"destinoIATA": "YYY",
"fechaIda": "YYYY-MM-DD",
"fechaVuelta": "YYYY-MM-DD"
}

Los códigos IATA los tenés que calcular vos (ej: Mendoza=MDZ, Buenos Aires=EZE, Miami=MIA, Madrid=MAD, Barcelona=BCN, Cancún=CUN, San Pablo=GRU, Río=GIG, Santiago=SCL, Lima=LIM, París=CDG, Roma=FCO, Londres=LHR).
Las fechas relativas convertilas a YYYY-MM-DD usando la fecha de hoy.`

export interface LLMResult {
  completo: boolean
  respuesta?: string
  datos?: DatosViaje
}

export async function procesarMensaje(
  historial: { role: 'user' | 'assistant'; content: string }[],
  mensaje: string,
): Promise<LLMResult> {
  if (MOCK) return procesarMockRegex(mensaje)

  const hoy = new Date().toISOString().split('T')[0]

  const text = await withRetry(
    async () => {
      const completion = await groq!.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + `\n\nHoy es ${hoy}.` },
          ...historial,
          { role: 'user', content: mensaje },
        ],
      })
      return completion.choices[0]?.message?.content?.trim() || ''
    },
    {
      label: 'groq',
      maxAttempts: 3,
      baseDelayMs: 1000,
      isRetriable: isHttpRetriable,
    },
  )

  return parsearRespuestaLLM(text)
}

function parsearRespuestaLLM(text: string): LLMResult {
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      const j = JSON.parse(match[0])
      if (
        j.origenIATA &&
        j.destinoIATA &&
        j.fechaIda &&
        j.fechaVuelta &&
        /^\d{4}-\d{2}-\d{2}$/.test(j.fechaIda) &&
        /^\d{4}-\d{2}-\d{2}$/.test(j.fechaVuelta)
      ) {
        return {
          completo: true,
          datos: {
            origenNombre: j.origenNombre || j.origenIATA,
            destinoNombre: j.destinoNombre || j.destinoIATA,
            origenIATA: String(j.origenIATA).toUpperCase(),
            destinoIATA: String(j.destinoIATA).toUpperCase(),
            fechaIda: j.fechaIda,
            fechaVuelta: j.fechaVuelta,
          },
        }
      }
    } catch {}
  }
  return { completo: false, respuesta: text }
}

function procesarMockRegex(mensaje: string): LLMResult {
  const iataPairs = mensaje.match(/\b([A-Z]{3})\b/g)
  const fechas = mensaje.match(/\b(\d{4}-\d{2}-\d{2})\b/g)
  if (iataPairs && iataPairs.length >= 2 && fechas && fechas.length >= 2) {
    return {
      completo: true,
      datos: {
        origenNombre: iataPairs[0],
        destinoNombre: iataPairs[1],
        origenIATA: iataPairs[0],
        destinoIATA: iataPairs[1],
        fechaIda: fechas[0],
        fechaVuelta: fechas[1],
      },
    }
  }
  return {
    completo: false,
    respuesta:
      '👋 ¡Hola! Soy el asistente de Smart Booking STG.\n\n' +
      'Para buscarte un vuelo necesito 4 datos:\n' +
      '• *Origen* (ciudad o IATA)\n' +
      '• *Destino*\n' +
      '• *Fecha de ida* (YYYY-MM-DD)\n' +
      '• *Fecha de vuelta*\n\n' +
      'Ejemplo: _MDZ MIA 2026-07-10 2026-07-20_',
  }
}
