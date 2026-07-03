// =====================================================
// Route /api/calculadora — búsqueda de vuelos en vivo
// Reusa la lógica de búsqueda del módulo bot (Google Flights
// con spread de 5 fechas) pero expuesta como endpoint JSON
// para que el front la pueda consumir.
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { buscarComparativa } from '../lib/flights'

const router = Router()

/**
 * POST /api/calculadora/buscar
 * Body: { origenIATA, destinoIATA, fechaIda, fechaVuelta, clase?, adultos? }
 * Respuesta: { opciones: OpcionVuelo[] }
 */
router.post('/buscar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { origenIATA, destinoIATA, fechaIda, fechaVuelta, clase, adultos } = req.body
    console.log('[calculadora] ▶ request recibido:', { origenIATA, destinoIATA, fechaIda, fechaVuelta, clase, adultos })
    const CLASES_VALIDAS = ['ECONOMICA', 'PREMIUM_ECONOMICA', 'EJECUTIVA', 'PRIMERA']

    // Validaciones básicas
    if (!origenIATA || !destinoIATA) {
      return res.status(400).json({
        error: 'Faltan origenIATA y destinoIATA',
      })
    }
    if (!/^[A-Z]{3}$/i.test(origenIATA) || !/^[A-Z]{3}$/i.test(destinoIATA)) {
      return res.status(400).json({
        error: 'origenIATA y destinoIATA deben ser códigos IATA de 3 letras',
      })
    }
    if (!fechaIda || !fechaVuelta) {
      return res.status(400).json({
        error: 'Faltan fechaIda y fechaVuelta (formato YYYY-MM-DD)',
      })
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fechaIda) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fechaVuelta)
    ) {
      return res.status(400).json({
        error: 'Las fechas deben tener formato YYYY-MM-DD',
      })
    }
    if (clase !== undefined && !CLASES_VALIDAS.includes(clase)) {
      return res.status(400).json({
        error: `clase inválida. Valores válidos: ${CLASES_VALIDAS.join(', ')}`,
      })
    }
    if (new Date(fechaVuelta) <= new Date(fechaIda)) {
      return res.status(400).json({
        error: 'La fecha de vuelta tiene que ser posterior a la de ida',
      })
    }

    const opciones = await buscarComparativa({
      origenIATA: String(origenIATA).toUpperCase(),
      destinoIATA: String(destinoIATA).toUpperCase(),
      fechaIda,
      fechaVuelta,
      clase,
      adultos: adultos ? Number(adultos) : undefined,
    })

    console.log(`[calculadora] ◀ devolviendo ${opciones.length} opciones`)
    return res.json({
      ok: true,
      origenIATA: String(origenIATA).toUpperCase(),
      destinoIATA: String(destinoIATA).toUpperCase(),
      clase: clase || 'ECONOMICA',
      adultos: adultos ? Number(adultos) : 1,
      total: opciones.length,
      opciones,
    })
  } catch (e) {
    next(e)
  }
})

export default router
