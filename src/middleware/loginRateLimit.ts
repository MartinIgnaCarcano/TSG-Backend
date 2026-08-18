// =====================================================
// Rate limiting específico para el login de admins.
// 5 intentos / 15 min por IP — defiende de fuerza bruta sobre
// las contraseñas (que están bien hasheadas con bcrypt, pero
// sin esto alguien podría probar miles de contraseñas igual).
// =====================================================
import rateLimit from 'express-rate-limit'

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Hallazgo C-4: sólo cuentan los intentos fallidos. Un vendedor que
  // entra bien diez veces en el día no gasta el presupuesto de intentos,
  // y el límite queda apuntando a lo que realmente interesa frenar, que
  // es la prueba de contraseñas. Requiere `app.set('trust proxy', 1)`
  // en index.ts para que la IP sea la real y no la del proxy.
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de login. Esperá unos minutos y volvé a intentar.' },
})
