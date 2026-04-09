"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const clientes_1 = __importDefault(require("./routes/clientes"));
const viajes_1 = __importDefault(require("./routes/viajes"));
const tramos_1 = __importDefault(require("./routes/tramos"));
const cotizaciones_1 = __importDefault(require("./routes/cotizaciones"));
const reservas_1 = __importDefault(require("./routes/reservas"));
const adminUsers_1 = __importDefault(require("./routes/adminUsers"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Rutas
app.use('/api/clientes', clientes_1.default);
app.use('/api/viajes', viajes_1.default);
app.use('/api/tramos', tramos_1.default);
app.use('/api/cotizaciones', cotizaciones_1.default);
app.use('/api/reservas', reservas_1.default);
app.use('/api/admin-users', adminUsers_1.default);
// Health check
app.get('/api', (req, res) => res.json({ message: 'API funcionando ✅' }));
// Handler global de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Server corriendo en puerto ${PORT}`));
