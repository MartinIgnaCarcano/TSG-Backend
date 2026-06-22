// =====================================================
// Retry con backoff exponencial — para llamadas externas
// inestables (Groq, RapidAPI). Sin dependencias externas.
// =====================================================

export interface RetryOptions {
  /** Cuántos intentos en total (default 3) */
  maxAttempts?: number
  /** Delay base en ms (default 1000) → 1s, 2s, 4s… */
  baseDelayMs?: number
  /** Etiqueta para los logs */
  label?: string
  /** Función opcional para decidir si un error es retriable. Por defecto retry en todo. */
  isRetriable?: (err: any) => boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    label = 'retry',
    isRetriable = () => true,
  } = opts

  let lastErr: any
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      lastErr = e
      if (attempt === maxAttempts || !isRetriable(e)) {
        console.error(`[${label}] falló después de ${attempt} intento(s):`, e.message)
        throw e
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1) // 1s, 2s, 4s
      console.warn(`[${label}] intento ${attempt} falló (${e.message}), reintento en ${delay}ms`)
      await sleep(delay)
    }
  }
  throw lastErr
}

/** Considera retriable los errores HTTP 5xx y 429 (rate limit). */
export function isHttpRetriable(err: any): boolean {
  const status = err?.response?.status ?? err?.status
  if (!status) return true // error de red / timeout
  return status === 429 || (status >= 500 && status < 600)
}
