"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const bcrypt_1 = __importDefault(require("bcrypt"));
const router = (0, express_1.Router)();
const SALT_ROUNDS = 10;
// GET /api/admin-users
router.get('/', async (req, res) => {
    try {
        const admins = await prisma_1.prisma.adminUser.findMany({
            where: { baja: null },
            select: { id: true, email: true, nombre: true, alta: true, modificacion: true },
            // ↑ nunca devolvemos password_hash
        });
        res.json(admins);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/admin-users/:id
router.get('/:id', async (req, res) => {
    try {
        const admin = await prisma_1.prisma.adminUser.findUnique({
            where: { id: Number(req.params.id) },
            select: { id: true, email: true, nombre: true, alta: true, modificacion: true },
        });
        if (!admin)
            return res.status(404).json({ error: 'Admin no encontrado' });
        res.json(admin);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/admin-users
router.post('/', async (req, res) => {
    try {
        const { email, nombre, password } = req.body;
        if (!password)
            return res.status(400).json({ error: 'La contraseña es requerida' });
        const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
        const admin = await prisma_1.prisma.adminUser.create({
            data: { email, nombre, passwordHash },
            select: { id: true, email: true, nombre: true, alta: true },
        });
        res.status(201).json(admin);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// POST /api/admin-users/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await prisma_1.prisma.adminUser.findUnique({ where: { email } });
        if (!admin || admin.baja)
            return res.status(401).json({ error: 'Credenciales inválidas' });
        const valid = await bcrypt_1.default.compare(password, admin.passwordHash);
        if (!valid)
            return res.status(401).json({ error: 'Credenciales inválidas' });
        res.json({ id: admin.id, email: admin.email, nombre: admin.nombre });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// PUT /api/admin-users/:id
router.put('/:id', async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        const data = { nombre, email };
        if (password)
            data.passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
        const admin = await prisma_1.prisma.adminUser.update({
            where: { id: Number(req.params.id) },
            data,
            select: { id: true, email: true, nombre: true, modificacion: true },
        });
        res.json(admin);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE lógico /api/admin-users/:id
router.delete('/:id', async (req, res) => {
    try {
        const admin = await prisma_1.prisma.adminUser.update({
            where: { id: Number(req.params.id) },
            data: { baja: new Date() },
            select: { id: true, email: true, baja: true },
        });
        res.json(admin);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
