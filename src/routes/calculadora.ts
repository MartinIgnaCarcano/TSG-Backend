// =====================================================
// Route /api/calculadora — búsqueda de vuelos en vivo
// Reusa la lógica de búsqueda del módulo bot (Google Flights
// con spread de 5 fechas) pero expuesta como endpoint JSON
// para que el front la pueda consumir.
// =====================================================
import { Router, Request, Response } from 'express'
import { buscarComparativa } from '../lib/flights'

const router = Router()

/**
 * POST /api/calculadora/buscar
 * Body: { origenIATA, destinoIATA, fechaIda, fechaVuelta }
 * Respuesta: { opciones: OpcionVuelo[] }
 */
router.post('/buscar', async (req: Request, res: Response) => {
  try {
    const { origenIATA, destinoIATA, fechaIda, fechaVuelta } = req.body

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
    })

    return res.json({
      ok: true,
      origenIATA: String(origenIATA).toUpperCase(),
      destinoIATA: String(destinoIATA).toUpperCase(),
      total: opciones.length,
      opciones,
    })
  } catch (e: any) {
    console.error('[calculadora] error:', e)
    return res.status(500).json({ error: e.message })
  }
})

export default router

