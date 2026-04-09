"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const router = (0, express_1.Router)();
// GET /api/cotizaciones?viajeId=...
router.get('/', async (req, res) => {
    try {
        const viajeId = req.query.viajeId;
        const cotizaciones = await prisma_1.prisma.cotizacion.findMany({
            where: { baja: null, ...(viajeId && { viajeId }) },
            include: { viaje: true, cliente: true },
            orderBy: { alta: 'desc' },
        });
        res.json(cotizaciones);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/cotizaciones/:id
router.get('/:id', async (req, res) => {
    try {
        const cotizacion = await prisma_1.prisma.cotizacion.findUnique({
            where: { id: req.params.id },
            include: {
                viaje: {
                    include: {
                        tramos: { where: { baja: null }, orderBy: { orden: 'asc' } },
                    },
                },
                cliente: true,
            },
        });
        if (!cotizacion)
            return res.status(404).json({ error: 'Cotización no encontrada' });
        res.json(cotizacion);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/cotizaciones
router.post('/', async (req, res) => {
    try {
        const { viajeId, clienteId, fechaVencimiento, moneda, precioIda, precioVuelta, precioIdaYVuelta, impuestos, observaciones, ofertaExternaID } = req.body;
        const numeroCotizacion = `COT-${Date.now()}`;
        const cotizacion = await prisma_1.prisma.cotizacion.create({
            data: {
                viajeId,
                clienteId,
                numeroCotizacion,
                fechaVencimiento: new Date(fechaVencimiento),
                moneda,
                precioIda,
                precioVuelta,
                precioIdaYVuelta,
                impuestos,
                observaciones,
                ofertaExternaID,
            },
        });
        res.status(201).json(cotizacion);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// PUT /api/cotizaciones/:id
router.put('/:id', async (req, res) => {
    try {
        const { fechaVencimiento, moneda, precioIda, precioVuelta, precioIdaYVuelta, impuestos, observaciones, estado, ofertaExternaID } = req.body;
        const cotizacion = await prisma_1.prisma.cotizacion.update({
            where: { id: req.params.id },
            data: {
                ...(fechaVencimiento && { fechaVencimiento: new Date(fechaVencimiento) }),
                moneda,
                precioIda,
                precioVuelta,
                precioIdaYVuelta,
                impuestos,
                observaciones,
                estado,
                ofertaExternaID,
            },
        });
        res.json(cotizacion);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
// DELETE lógico /api/cotizaciones/:id
router.delete('/:id', async (req, res) => {
    try {
        const cotizacion = await prisma_1.prisma.cotizacion.update({
            where: { id: req.params.id },
            data: { baja: new Date() },
        });
        res.json(cotizacion);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
