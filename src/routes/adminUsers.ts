import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { loginRateLimit } from '../middleware/loginRateLimit'
import { requireAdminBearer } from '../middleware/auth'

const router = Router()
const SALT_ROUNDS = 10

// GET /api/admin-users
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admins = await prisma.adminUser.findMany({
      where: { baja: null },
      select: { id: true, email: true, nombre: true, alta: true, modificacion: true },
      // ↑ nunca devolvemos password_hash
    })
    res.json(admins)
  } catch (e) {
    next(e)
  }
})

// GET /api/admin-users/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, email: true, nombre: true, alta: true, modificacion: true },
    })
    if (!admin) return res.status(404).json({ error: 'Admin no encontrado' })
    res.json(admin)
  } catch (e) {
    next(e)
  }
})

// POST /api/admin-users
// Fase S6: creación de admins fuera del alcance de la x-api-key de n8n —
// exige Bearer de un admin ya logueado (ver requireAdminBearer). El
// primer admin lo crea prisma/seed.ts.
router.post('/', requireAdminBearer, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, nombre, password } = req.body
    if (!password) return res.status(400).json({ error: 'La contraseña es requerida' })

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
    const admin = await prisma.adminUser.create({
      data: { email, nombre, passwordHash },
      select: { id: true, email: true, nombre: true, alta: true },
    })
    res.status(201).json(admin)
  } catch (e) {
    next(e)
  }
})

// POST /api/admin-users/login
router.post('/login', loginRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body
    const admin = await prisma.adminUser.findUnique({ where: { email } })
    if (!admin || admin.baja) return res.status(401).json({ error: 'Credenciales inválidas' })

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' })

    const token = jwt.sign({ id: admin.id, email: admin.email }, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions)

    res.json({
      token,
      user: { id: admin.id, email: admin.email, nombre: admin.nombre },
    })
  } catch (e) {
    next(e)
  }
})

// PUT /api/admin-users/:id — Fase S6: mismo criterio que el POST.
router.put('/:id', requireAdminBearer, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, email, password } = req.body
    const data: any = { nombre, email }
    if (password) data.passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    const admin = await prisma.adminUser.update({
      where: { id: Number(req.params.id) },
      data,
      select: { id: true, email: true, nombre: true, modificacion: true },
    })
    res.json(admin)
  } catch (e) {
    next(e)
  }
})

// DELETE lógico /api/admin-users/:id — Fase S6: mismo criterio que el POST.
router.delete('/:id', requireAdminBearer, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const admin = await prisma.adminUser.update({
      where: { id: Number(req.params.id) },
      data: { baja: new Date() },
      select: { id: true, email: true, baja: true },
    })
    res.json(admin)
  } catch (e) {
    next(e)
  }
})

export default router

