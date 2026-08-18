-- Hallazgo B-5 de la auditoría de ingeniería: índices de los accesos
-- frecuentes a `reservas` (listado del panel, ficha del cliente y
-- búsqueda de reservas por vencer del Flujo 4).

-- CreateIndex
CREATE INDEX "reservas_baja_estado_idx" ON "reservas"("baja", "estado");

-- CreateIndex
CREATE INDEX "reservas_cliente_id_idx" ON "reservas"("cliente_id");

-- CreateIndex
CREATE INDEX "reservas_fecha_viaje_idx" ON "reservas"("fecha_viaje");
