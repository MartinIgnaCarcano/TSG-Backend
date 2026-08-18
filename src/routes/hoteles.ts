// =====================================================
// /api/hoteles — CRUD del catálogo de hoteles
// Usado por el panel admin y por el Flujo 6 (buscar hoteles)
// =====================================================
import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// GET /api/hoteles
//   ?destinoId=...        → filtra por destino
//   ?destinoIATA=MAD      → filtra por IATA
//   ?estrellas=4          → filtra por estrellas
//   ?max=100              → precio máx por noche
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destinoId = req.query.destinoId as string | undefined
    const destinoIATA = (req.query.destinoIATA as string | undefined)?.toUpperCase()
    const estrellas = req.query.estrellas ? parseInt(req.query.estrellas as string) : undefined
    const max = req.query.max ? parseFloat(req.query.max as string) : undefined

    const where: any = { baja: null }
    if (destinoId) where.destinoId = destinoId
    if (estrellas) where.estrellas = estrellas

    // Si vino IATA, lo resolvemos al destinoId
    if (destinoIATA && !destinoId) {
      const dest = await prisma.destino.findUnique({ where: { codigoIATA: destinoIATA } })
      if (!dest) return res.json([])
      where.destinoId = dest.id
    }

    let hoteles = await prisma.hotel.findMany({
      where,
      include: { destino: true },
      orderBy: [{ estrellas: 'desc' }, { precioNoche: 'asc' }],
    })

    if (max) hoteles = hoteles.filter((h) => Number(h.precioNoche) <= max)
    res.json(hoteles)
  } catch (e) {
    next(e)
  }
})

// GET /api/hoteles/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hotel = await prisma.hotel.findUnique({
      where: { id: req.params.id as string },
      include: { destino: true },
    })
    if (!hotel) return res.status(404).json({ error: 'Hotel no encontrado' })
    res.json(hotel)
  } catch (e) {
    next(e)
  }
})

// POST /api/hoteles
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      nombre, destinoId, destinoIATA,
      estrellas, precioNoche, moneda,
      descripcion, direccion, urlImagen, urlReserva,
      fuente, rating,
    } = req.body

    if (!nombre) return res.status(400).json({ error: 'Falta nombre' })
    if (precioNoche == null) return res.status(400).json({ error: 'Falta precioNoche' })

    // Resolver destinoId desde IATA si viene
    let dId = destinoId
    if (!dId && destinoIATA) {
      const d = await prisma.destino.findUnique({ where: { codigoIATA: String(destinoIATA).toUpperCase() } })
      if (!d) return res.status(400).json({ error: `Destino IATA ${destinoIATA} no existe` })
      dId = d.id
    }
    if (!dId) return res.status(400).json({ error: 'Falta destinoId o destinoIATA' })

    const hotel = await prisma.hotel.create({
      data: {
        nombre,
        destinoId: dId,
        estrellas: estrellas ?? 3,
        precioNoche,
        moneda: moneda || 'USD',
        descripcion,
        direccion,
        urlImagen,
        urlReserva,
        fuente: fuente || 'MANUAL',
        rating: rating != null ? rating : undefined,
      },
      include: { destino: true },
    })
    res.status(201).json(hotel)
  } catch (e) {
    next(e)
  }
})

// PUT /api/hoteles/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      nombre, destinoId, destinoIATA,
      estrellas, precioNoche, moneda,
      descripcion, direccion, urlImagen, urlReserva,
      fuente, rating,
    } = req.body

    let dId = destinoId
    if (!dId && destinoIATA) {
      const d = await prisma.destino.findUnique({ where: { codigoIATA: String(destinoIATA).toUpperCase() } })
      if (d) dId = d.id
    }

    const hotel = await prisma.hotel.update({
      where: { id: req.params.id as string },
      data: {
        nombre,
        ...(dId && { destinoId: dId }),
        estrellas,
        precioNoche,
        moneda,
        descripcion,
        direccion,
        urlImagen,
        urlReserva,
        fuente,
        rating,
      },
      include: { destino: true },
    })
    res.json(hotel)
  } catch (e) {
    next(e)
  }
})

// DELETE lógico /api/hoteles/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hotel = await prisma.hotel.update({
      where: { id: req.params.id as string },
      data: { baja: new Date() },
    })
    res.json(hotel)
  } catch (e) {
    next(e)
  }
})

// POST /api/hoteles/bulk — usado por el Flujo 6, recibe array y hace upsert por (nombre + destinoId)
//
// Hallazgo M-3 de la auditoría de ingeniería: recorría un array sin límite
// de tamaño haciendo dos o tres consultas por elemento (un findUnique del
// destino, un findFirst del hotel y la escritura), y sin transacción. Con
// un array grande eran cientos de round-trips secuenciales contra la base
// y un resultado que podía quedar a medio aplicar.
//
// Ahora: se acota el tamaño, los destinos y los hoteles existentes se
// resuelven en dos consultas para todo el lote, y las escrituras van en
// una transacción. El contrato de respuesta se mantiene (`creados`,
// `actualizados`, `total`) y se agregan dos contadores de diagnóstico.
const MAX_BULK = 200

router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items: any[] = Array.isArray(req.body) ? req.body : (req.body.items || [])
    if (!items.length) return res.status(400).json({ error: 'Array vacío' })
    if (items.length > MAX_BULK) {
      return res.status(413).json({
        error: `Máximo ${MAX_BULK} hoteles por llamada (llegaron ${items.length}). Partilo en varias.`,
      })
    }

    // 1. Todos los destinos que aparecen en el lote, en una sola consulta.
    const iatas = [
      ...new Set(
        items
          .filter((i) => !i.destinoId && i.destinoIATA)
          .map((i) => String(i.destinoIATA).toUpperCase()),
      ),
    ]
    const destinos = iatas.length
      ? await prisma.destino.findMany({ where: { codigoIATA: { in: iatas } } })
      : []
    const destinoPorIata = new Map(destinos.map((d) => [d.codigoIATA, d.id]))

    // 2. Normalizar: resolver el destino y descartar lo que no sirve.
    //    Los repetidos dentro del mismo lote se descartan también: si no,
    //    dos entradas iguales creaban dos hoteles idénticos.
    const clave = (nombre: string, destinoId: string) => `${destinoId}::${nombre}`
    const vistos = new Set<string>()
    let descartados = 0
    let duplicadosEnElLote = 0

    const normalizados = items.flatMap((item) => {
      const destinoId: string | undefined =
        item.destinoId ||
        (item.destinoIATA ? destinoPorIata.get(String(item.destinoIATA).toUpperCase()) : undefined)

      if (!destinoId || !item.nombre) {
        descartados++
        return []
      }
      const k = clave(item.nombre, destinoId)
      if (vistos.has(k)) {
        duplicadosEnElLote++
        return []
      }
      vistos.add(k)
      return [{ ...item, destinoId }]
    })

    // 3. Los hoteles ya existentes de esos destinos, en una sola consulta.
    const destinoIds = [...new Set(normalizados.map((i) => i.destinoId))]
    const existentes = destinoIds.length
      ? await prisma.hotel.findMany({ where: { baja: null, destinoId: { in: destinoIds } } })
      : []
    const existentePorClave = new Map(existentes.map((h) => [clave(h.nombre, h.destinoId), h]))

    // 4. Repartir entre altas y modificaciones.
    const aCrear: any[] = []
    const aActualizar: { id: string; data: any }[] = []

    for (const item of normalizados) {
      const existente = existentePorClave.get(clave(item.nombre, item.destinoId))
      if (existente) {
        aActualizar.push({
          id: existente.id,
          data: {
            estrellas: item.estrellas ?? existente.estrellas,
            precioNoche: item.precioNoche ?? existente.precioNoche,
            urlImagen: item.urlImagen ?? existente.urlImagen,
            urlReserva: item.urlReserva ?? existente.urlReserva,
            descripcion: item.descripcion ?? existente.descripcion,
            rating: item.rating ?? existente.rating,
            fuente: item.fuente || existente.fuente,
          },
        })
      } else {
        aCrear.push({
          nombre: item.nombre,
          destinoId: item.destinoId,
          estrellas: item.estrellas ?? 3,
          precioNoche: item.precioNoche ?? 0,
          moneda: item.moneda || 'USD',
          descripcion: item.descripcion,
          direccion: item.direccion,
          urlImagen: item.urlImagen,
          urlReserva: item.urlReserva,
          rating: item.rating,
          fuente: item.fuente || 'RAPIDAPI',
        })
      }
    }

    // 5. Escribir todo junto: o entra el lote entero o no entra ninguno.
    await prisma.$transaction(
      async (tx) => {
        if (aCrear.length) await tx.hotel.createMany({ data: aCrear })
        for (const u of aActualizar) {
          await tx.hotel.update({ where: { id: u.id }, data: u.data })
        }
      },
      { timeout: 20_000 },
    )

    res.json({
      ok: true,
      creados: aCrear.length,
      actualizados: aActualizar.length,
      descartados,
      duplicadosEnElLote,
      total: items.length,
    })
  } catch (e) {
    next(e)
  }
})

export default router
