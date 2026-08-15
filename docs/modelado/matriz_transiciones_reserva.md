# Matriz de transiciones de la entidad Reserva

**Fuente:** `TRANSICIONES_VALIDAS` en `src/services/reservas.service.ts`
**Cubre:** hallazgo A-11 de la auditoría — «la máquina de estados se declara central y nunca se especifica»
**Verificación:** 10 tests unitarios en `src/services/reservas.service.test.ts` + prueba de integración en `scripts/test_maquina_estados.mjs`

---

## Matriz

Filas = estado origen · Columnas = estado destino · ✓ = transición permitida

| desde ↓ \ hacia → | EN_PROCESO | SEÑADA | PAGADA | DOCUMENTADA | EN_VIAJE | FINALIZADA | CANCELADA |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **EN_PROCESO**  | — | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| **SEÑADA**      | ✗ | — | ✓ | ✗ | ✗ | ✗ | ✓ |
| **PAGADA**      | ✓¹ | ✓¹ | — | ✓ | ✗ | ✗ | ✓ |
| **DOCUMENTADA** | ✗ | ✗ | ✗ | — | ✓ | ✗ | ✓ |
| **EN_VIAJE**    | ✗ | ✗ | ✗ | ✗ | — | ✓ | ✓ |
| **FINALIZADA**  | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ |
| **CANCELADA**   | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — |

¹ Retrocesos admitidos **únicamente** por anulación de pago (`anularPago`, Fase S5). No son transiciones de avance del ciclo comercial sino reversiones contables.

**Totales:** 7 estados · 42 pares posibles (excluida la diagonal) · **14 transiciones permitidas** · **28 prohibidas**.

---

## Condiciones de guarda

| Transición | Guarda | Dónde se aplica |
|---|---|---|
| `EN_PROCESO → SEÑADA` | Se registra un pago parcial (`saldoPendiente > 0`) | `registrarPago()` |
| `EN_PROCESO → PAGADA` | Se registra un pago que cubre el monto final | `registrarPago()` |
| `SEÑADA → PAGADA` | `saldoPendiente <= 0` tras acumular pagos | `registrarPago()` |
| `PAGADA → DOCUMENTADA` | Se emite voucher o contrato correctamente | `POST /reservas/:id/voucher` |
| `PAGADA → SEÑADA` | Anulación de un pago que deja saldo pendiente > 0 | `anularPago()` |
| `PAGADA → EN_PROCESO` | Anulación del único pago (saldo pagado vuelve a 0) | `anularPago()` |
| `DOCUMENTADA → EN_VIAJE` | Se alcanza `fechaViaje` | proceso programado |
| `EN_VIAJE → FINALIZADA` | Se alcanza `fechaRegreso` | proceso programado |
| `* → CANCELADA` | Cancelación explícita desde cualquier estado no terminal | `PATCH /reservas/:id/cancelar` |

**Estados terminales:** `FINALIZADA` y `CANCELADA` no admiten ninguna transición de salida.

---

## Control de concurrencia

`transicionarEstado()` no escribe con un `update` directo. Lee el estado actual, valida la transición contra la matriz y ejecuta un `updateMany` **condicionado al estado leído**:

```
UPDATE reserva SET estado = :nuevo WHERE id = :id AND estado = :leido
```

Si el `updateMany` afecta **0 filas**, significa que otra operación concurrente modificó el estado entre la lectura y la escritura, y se lanza `TransicionInvalidaError` sin releer. Es un **bloqueo optimista**: garantiza que dos transiciones simultáneas no puedan dejar la reserva en un estado inalcanzable.

Esto está cubierto por el test `transiciones concurrentes: si el updateMany afecta 0 filas, lanza TransicionInvalidaError sin releer la reserva`, y se ejerce a nivel de integración en el escenario **E2** de `scripts/test_concurrencia.mjs`.

---

## Por qué la matriz importa para el dominio

La garantía que aporta no es formal sino operativa: como `DOCUMENTADA` solo es alcanzable desde `PAGADA`, y `PAGADA` exige que la suma de pagos cubra el monto final, **un voucher emitido implica necesariamente una reserva cobrada**. Los subsistemas que consumen el estado —generación documental, recordatorios, reportes— pueden confiar en esa invariante sin revalidarla.

Lo mismo aplica al revés: la imposibilidad de `EN_PROCESO → DOCUMENTADA` impide emitir documentación de una reserva impaga por un error de la interfaz o de una integración.

---

## Cómo citarlo en la tesis

Esta matriz reemplaza la enumeración en prosa del §4.2.2. Sugerencia de ubicación:

- **§4.2.2** — la matriz como tabla, más el párrafo de control de concurrencia.
- **§5.3** — el resultado de `test_maquina_estados.mjs`: cuántos pares se evaluaron, cuántas transiciones inválidas se rechazaron correctamente. Reemplaza la verificación de una sola transición que el auditor observa.
- **Figura nueva** — el diagrama de estados de `docs/diagrama_estados_reserva.mermaid`.
