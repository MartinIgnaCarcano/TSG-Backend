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
  message: { error: 'Demasiados intentos de login. Esperá unos minutos y volvé a intentar.' },
})
