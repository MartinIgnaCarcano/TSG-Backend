"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /api/viajes
router.get('/', async (req, res) => {
    try {
        const viajes = await prisma_1.prisma.viaje.findMany({
            where: { baja: null },
            include: {
                origen: true,
                destino: true,
                tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
                cotizaciones: { where: { baja: null } },
            },
            orderBy: { alta: 'asc' },
        });
        res.json(viajes);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/viajes/:id
router.get('/:id', async (req, res) => {
    try {
        const viaje = await prisma_1.prisma.viaje.findUnique({
            where: { id: req.params.id },
            include: {
                origen: true,
                destino: true,
                tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
                cotizaciones: { where: { baja: null } },
            },
        });
        if (!viaje)
            return res.status(404).json({ error: 'Viaje no encontrado' });
        res.json(viaje);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/viajes
router.post('/', async (req, res) => {
    try {
        const { origenId, destinoId, tieneEscalas, descripcion, tramos } = req.body;
        const viaje = await prisma_1.prisma.viaje.create({
            data: {
                origenId,
                destinoId,
                tieneEscalas,
                descripcion,
                tramos: tramos
                    ? {
                        create: tramos.map((t) => ({
                            origenId: t.origenId,
                            destinoId: t.destinoId,
                            orden: t.orden,
                            duracionMinutos: t.duracionMinutos,
                            horaSalida: t.horaSalida ? new Date(t.horaSalida) : undefined,
                            horaLlegada: t.horaLlegada ? new Date(t.horaLlegada) : undefined,
                            aerolinea: t.aerolinea,
                            completo: t.completo ?? false,
                        })),
                    }
                    : undefined,
            },
            include: {
                origen: true,
                destino: true,
                tramos: { orderBy: { orden: 'asc' } },
            },
        });
        res.status(201).json(viaje);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// PUT /api/viajes/:id
router.put('/:id', async (req, res) => {
    try {
        const { origenId, destinoId, tieneEscalas, descripcion } = req.body;
        const viaje = await prisma_1.prisma.viaje.update({
            where: { id: req.params.id },
            data: { origenId, destinoId, tieneEscalas, descripcion },
        });
        res.json(viaje);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE lógico /api/viajes/:id  (baja también los tramos y cotizaciones)
router.delete('/:id', async (req, res) => {
    try {
        const [, , viaje] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.tramo.updateMany({
                where: { viajeId: req.params.id },
                data: { baja: new Date() },
            }),
            prisma_1.prisma.cotizacion.updateMany({
                where: { viajeId: req.params.id },
                data: { baja: new Date() },
            }),
            prisma_1.prisma.viaje.update({
                where: { id: req.params.id },
                data: { baja: new Date() },
            }),
        ]);
        res.json(viaje);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
