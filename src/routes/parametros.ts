// =====================================================
// /api/parametros — config del sistema (tipo de cambio, etc)
// Usado por el Flujo 5 (actualización diaria del dólar)
// =====================================================
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/parametros          → todos
// GET /api/parametros/:clave   → uno
router.get('/', async (_req: Request, res: Response) => {
  try {
    const params = await prisma.parametroSistema.findMany({
      orderBy: { clave: 'asc' },
    })
    res.json(params)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:clave', async (req: Request, res: Response) => {
  try {
    const p = await prisma.parametroSistema.findUnique({
      where: { clave: req.params.clave as string },
    })
    if (!p) return res.status(404).json({ error: `Parámetro "${req.params.clave}" no encontrado` })
    res.json(p)
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/parametros/:clave — upsert (crear o actualizar)
router.put('/:clave', async (req: Request, res: Response) => {
  try {
    const { valor, descripcion } = req.body
    if (valor == null) return res.status(400).json({ error: 'Falta "valor"' })

    const p = await prisma.parametroSistema.upsert({
      where: { clave: req.params.clave as string },
      update: { valor: String(valor), descripcion },
      create: { clave: req.params.clave as string, valor: String(valor), descripcion },
    })
    res.json(p)
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

// DELETE /api/parametros/:clave
router.delete('/:clave', async (req: Request, res: Response) => {
  try {
    await prisma.parametroSistema.delete({ where: { clave: req.params.clave as string } })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ error: e.message })
  }
})

export default router

