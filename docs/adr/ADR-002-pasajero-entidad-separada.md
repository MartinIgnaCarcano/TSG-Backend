# ADR-002 — `Pasajero` como entidad separada de `Cliente`

**Fecha:** 2026-07-02
**Estado:** Aceptada (implementada)

## Contexto

Una `Reserva` puede incluir a varias personas viajando (grupo familiar, pareja, grupo de amigos), cada una con datos propios — nombre, apellido, tipo y número de documento, fecha de nacimiento, nacionalidad, necesidad de asistencia especial — que no necesariamente coinciden con los del `Cliente` que hizo la reserva (el titular puede reservar para terceros). Estos datos son obligatorios para emitir vouchers y contratos.

Alternativas evaluadas: (a) ampliar `Cliente` con un array/tabla de acompañantes vinculado directamente al cliente, o (b) modelar `Pasajero` como entidad propia asociada a la `Reserva`.

## Decisión

Se modela `Pasajero` como entidad separada, en relación 1–N con `Reserva` (`onDelete: Cascade`), con un flag `esTitular` para marcar cuál de los pasajeros coincide con el `Cliente` de esa reserva. El campo de asistencia especial se modela por pasajero (no por cliente ni por reserva), porque la necesidad es individual.

## Consecuencias

**Positivas:**
- Un DNI y fecha de nacimiento por persona real que viaja, que es lo que exige el voucher/contrato — no se fuerza esa información dentro de `Cliente`.
- `Cliente` sigue representando exclusivamente la relación comercial (quien paga, quien recibe cotizaciones y notificaciones) sin mezclarse con los datos de terceros que solo viajan.
- Soporta N pasajeros por reserva sin duplicar `Cliente` ni `Reserva`, y sin que agregar/quitar un pasajero afecte al resto del modelo.

**Negativas / trade-offs:**
- Requiere mantener `esTitular` sincronizado manualmente cuando cambia el titular o se agrega/quita al propio cliente como pasajero.
- Cualquier consulta que necesite "todos los datos de una reserva" tiene que hacer join explícito con `Pasajero` — no viene incluido automáticamente al traer `Cliente`.
