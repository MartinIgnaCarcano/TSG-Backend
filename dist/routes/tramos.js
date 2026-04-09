"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /api/tramos?viajeId=...
router.get('/', async (req, res) => {
    try {
        const viajeId = req.query.viajeId;
        const tramos = await prisma_1.prisma.tramo.findMany({
            where: { baja: null, ...(viajeId && { viajeId }) },
            include: { origen: true, destino: true },
            orderBy: [{ viajeId: 'asc' }, { orden: 'asc' }],
        });
        res.json(tramos);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/tramos/:id
router.get('/:id', async (req, res) => {
    try {
        const tramo = await prisma_1.prisma.tramo.findUnique({
            where: { id: req.params.id },
            include: { viaje: true, origen: true, destino: true },
        });
        if (!tramo)
            return res.status(404).json({ error: 'Tramo no encontrado' });
        res.json(tramo);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/tramos
router.post('/', async (req, res) => {
    try {
        const { origenId, destinoId, orden, duracionMinutos, horaSalida, horaLlegada, aerolinea, completo, viajeId } = req.body;
        const tramo = await prisma_1.prisma.tramo.create({
            data: {
                origenId,
                destinoId,
                orden,
                duracionMinutos,
                horaSalida: horaSalida ? new Date(horaSalida) : undefined,
                horaLlegada: horaLlegada ? new Date(horaLlegada) : undefined,
                aerolinea,
                completo: completo ?? false,
                viajeId,
            },
        });
        res.status(201).json(tramo);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// PUT /api/tramos/:id
router.put('/:id', async (req, res) => {
    try {
        const { origenId, destinoId, orden, duracionMinutos, horaSalida, horaLlegada, aerolinea, completo } = req.body;
        const tramo = await prisma_1.prisma.tramo.update({
            where: { id: req.params.id },
            data: {
                origenId,
                destinoId,
                orden,
                duracionMinutos,
                ...(horaSalida && { horaSalida: new Date(horaSalida) }),
                ...(horaLlegada && { horaLlegada: new Date(horaLlegada) }),
                aerolinea,
                completo,
            },
        });
        res.json(tramo);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE lógico /api/tramos/:id
router.delete('/:id', async (req, res) => {
    try {
        const tramo = await prisma_1.prisma.tramo.update({
            where: { id: req.params.id },
            data: { baja: new Date() },
        });
        res.json(tramo);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
