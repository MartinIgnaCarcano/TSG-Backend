// =====================================================
// Fase B/C — consulta de DocumentoGenerado (voucher/contrato/cotización)
// y, en Fase C, registro de aceptación del contrato.
//
// Fase S3: el archivo en sí ya NO se sirve como estático público. El
// campo `url` que se expone por API se reemplaza en el momento de la
// consulta por un link firmado y con vencimiento (`urlPublicaDocumento`,
// en lib/documentos.ts) que apunta a GET /:id/descargar.
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { validateBody } from '../middleware/validate'
import { aceptarDocumentoSchema } from '../schemas/documento.schema'
import { config } from '../config'
import { validarFirmaDocumento, urlPublicaDocumento } from '../lib/documentos'

const router = Router()

// GET /api/documentos?reservaId=...&tipo=VOUCHER
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservaId = req.query.reservaId as string | undefined
    const tipo = req.query.tipo as string | undefined
    const documentos = await prisma.documentoGenerado.findMany({
      where: { ...(reservaId && { reservaId }), ...(tipo && { tipo: tipo as any }) },
      orderBy: [{ reservaId: 'asc' }, { tipo: 'asc' }, { version: 'desc' }],
    })
    res.json(documentos.map((d) => ({ ...d, url: urlPublicaDocumento(d) })))
  } catch (e) {
    next(e)
  }
})

// GET /api/documentos/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documento = await prisma.documentoGenerado.findUnique({ where: { id: req.params.id as string } })
    if (!documento) return res.status(404).json({ error: 'Documento no encontrado' })
    res.json({ ...documento, url: urlPublicaDocumento(documento) })
  } catch (e) {
    next(e)
  }
})

// GET /api/documentos/:id/descargar?exp=<epoch>&sig=<hmac> — Fase S3.
// Ruta pública (ver middleware/auth.ts): el link se manda por WhatsApp/
// email directo al cliente final, que no tiene JWT ni x-api-key. La
// protección es la firma HMAC-SHA256 con vencimiento, no una sesión.
router.get('/:id/descargar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string
    const exp = Number(req.query.exp)
    const sig = typeof req.query.sig === 'string' ? req.query.sig : ''

    if (!validarFirmaDocumento(id, exp, sig)) {
      return res.status(403).json({ error: 'El enlace es inválido o venció' })
    }

    const documento = await prisma.documentoGenerado.findUnique({ where: { id } })
    if (!documento || !documento.url) return res.status(404).json({ error: 'Documento no encontrado' })

    // `documento.url` es la ruta relativa interna (ej.
    // /storage/documentos/voucher-RES-123-169....pdf); acá solo importa
    // el nombre de archivo — path.basename evita cualquier path traversal.
    const nombreArchivo = path.basename(documento.url)
    const rutaArchivo = path.join(process.cwd(), config.documentosStorageDir, nombreArchivo)
    if (!fs.existsSync(rutaArchivo)) return res.status(404).json({ error: 'Documento no encontrado' })

    res.sendFile(rutaArchivo)
  } catch (e) {
    next(e)
  }
})

// POST /api/documentos/:id/aceptar — Fase C: registra la aceptación de un
// contrato (sin firma digital avanzada, alcanza con dejar trazabilidad).
router.post('/:id/aceptar', validateBody(aceptarDocumentoSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { medio } = req.body
    const documento = await prisma.documentoGenerado.update({
      where: { id: req.params.id as string },
      data: { aceptado: true, fechaAceptacion: new Date(), medioAceptacion: medio },
    })
    res.json(documento)
  } catch (e) {
    next(e)
  }
})

export default router
