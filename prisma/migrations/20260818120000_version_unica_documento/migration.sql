-- Hallazgo A-2 de la auditoría de ingeniería.
--
-- La versión de un documento se calculaba como count(...) + 1 fuera de
-- toda transacción y no había ninguna restricción que impidiera repetirla:
-- dos emisiones simultáneas del mismo voucher producían dos documentos
-- "versión 1", con contenidos potencialmente distintos y sin forma de
-- saber cuál era el vigente.
--
-- El índice único convierte esa corrupción silenciosa en un error visible
-- (violación de restricción), que es lo que corresponde.
--
-- Si esta migración falla con "could not create unique index", es porque
-- la base ya tiene duplicados. Para verlos:
--   SELECT reserva_id, tipo, version, count(*)
--     FROM documentos_generados
--    GROUP BY 1, 2, 3 HAVING count(*) > 1;

-- CreateIndex
CREATE UNIQUE INDEX "documentos_generados_reserva_id_tipo_version_key"
    ON "documentos_generados"("reserva_id", "tipo", "version");
