"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /api/clientes
router.get('/', async (req, res) => {
    try {
        const clientes = await prisma_1.prisma.cliente.findMany({
            where: { baja: null },
            orderBy: { alta: 'desc' },
        });
        res.json(clientes);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
    try {
        const cliente = await prisma_1.prisma.cliente.findUnique({
            where: { id: req.params.id },
            include: {
                reservas: {
                    where: { baja: null },
                    include: {
                        cotizacion: true,
                    },
                },
            },
        });
        if (!cliente)
            return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json(cliente);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/clientes
router.post('/', async (req, res) => {
    try {
        const { nombre, apellido, telefono, email } = req.body;
        const numeroCliente = `CLI-${Date.now()}`;
        const cliente = await prisma_1.prisma.cliente.create({
            data: { nombre, apellido, telefono, email, numeroCliente },
        });
        res.status(201).json(cliente);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// PUT /api/clientes/:id
router.put('/:id', async (req, res) => {
    try {
        const { nombre, apellido, telefono, email } = req.body;
        const cliente = await prisma_1.prisma.cliente.update({
            where: { id: req.params.id },
            data: { nombre, apellido, telefono, email },
        });
        res.json(cliente);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE lógico /api/clientes/:id
router.delete('/:id', async (req, res) => {
    try {
        const cliente = await prisma_1.prisma.cliente.update({
            where: { id: req.params.id },
            data: { baja: new Date() },
        });
        res.json(cliente);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
