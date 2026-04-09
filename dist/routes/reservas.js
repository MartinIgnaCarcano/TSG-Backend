"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// GET /api/reservas?clienteId=...&estado=EN_PROCESO
router.get('/', async (req, res) => {
    try {
        const clienteId = req.query.clienteId;
        const estado = req.query.estado;
        const reservas = await prisma_1.prisma.reserva.findMany({
            where: {
                baja: null,
                ...(clienteId && { clienteId }),
                ...(estado && { estado }),
            },
            include: {
                cliente: true,
                cotizacion: {
                    include: {
                        viaje: {
                            include: {
                                tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
                            },
                        },
                    },
                },
            },
            orderBy: { alta: 'desc' },
        });
        res.json(reservas);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/reservas/:id
router.get('/:id', async (req, res) => {
    try {
        const reserva = await prisma_1.prisma.reserva.findUnique({
            where: { id: req.params.id },
            include: {
                cliente: true,
                cotizacion: {
                    include: {
                        viaje: {
                            include: {
                                tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
                            },
                        },
                    },
                },
            },
        });
        if (!reserva)
            return res.status(404).json({ error: 'Reserva no encontrada' });
        res.json(reserva);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/reservas
router.post('/', async (req, res) => {
    try {
        const { clienteId, cotizacionId, tipoReserva, montoFinal, observaciones } = req.body;
        const numeroReserva = `RES-${Date.now()}`;
        const reserva = await prisma_1.prisma.reserva.create({
            data: { clienteId, cotizacionId, tipoReserva, montoFinal, numeroReserva, observaciones },
            include: {
                cliente: true,
                cotizacion: true,
            },
        });
        res.status(201).json(reserva);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// PUT /api/reservas/:id
router.put('/:id', async (req, res) => {
    try {
        const { cotizacionId, tipoReserva, montoFinal, estado, observaciones } = req.body;
        const reserva = await prisma_1.prisma.reserva.update({
            where: { id: req.params.id },
            data: { cotizacionId, tipoReserva, montoFinal, estado, observaciones },
        });
        res.json(reserva);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// PATCH /api/reservas/:id/confirmar
router.patch('/:id/confirmar', async (req, res) => {
    try {
        const reserva = await prisma_1.prisma.reserva.update({
            where: { id: req.params.id },
            data: { estado: client_1.EstadoReserva.CONFIRMADA },
        });
        res.json(reserva);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE lógico /api/reservas/:id
router.delete('/:id', async (req, res) => {
    try {
        const reserva = await prisma_1.prisma.reserva.update({
            where: { id: req.params.id },
            data: { baja: new Date() },
        });
        res.json(reserva);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
