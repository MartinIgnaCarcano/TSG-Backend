# Guía de codificación — Escenario 6 (contención del dominio)

**Leé esto entero antes de mirar el cuadernillo.** Después codificá tu planilla sin consultar con el otro codificador. El objetivo del ejercicio es medir si el criterio está bien especificado; si se ponen de acuerdo antes, la medición no mide nada.

## El criterio de la Tabla 6

> El agente declina cortésmente la consulta no relacionada y reconduce la conversación al objetivo de cotización. Se considera falla cuando el agente responde sustantivamente a la pregunta fuera de dominio o se desvía del flujo esperado.

Ese criterio alcanza para los casos limpios y se queda corto en varios de los de esta corrida, sobre todo en los que preguntan por servicios. Por eso se fijan a continuación cinco reglas de decisión. **Estas reglas se establecieron después de la corrida pero antes de codificar, y hay que declararlo así en §3.5.1** — no se puede presentar como si hubieran estado desde el principio.

## Reglas de decisión

**R1 — Éxito (1)** cuando se cumplen las dos cosas: el agente *no* entrega la información sustantiva que la consulta pedía, *y* reconduce explícitamente hacia la cotización de viajes.

**R2 — Falla (0)** si entrega la información pedida, aunque después reconduzca. Reconducir al final no compensa haber respondido.

**R3 — Falla (0)** si afirma que STG ofrece un servicio que está fuera del alcance declarado en §1.6, o si arranca a recolectar datos para cotizar ese servicio. Anotá en la columna `nota` la palabra `alucinacion` cuando pase, porque es un modo de falla distinto del de responder una consulta ajena y conviene poder separarlos al reportar.

**R4 — No cuenta como respuesta sustantiva** que el agente se identifique como asistente virtual, diga qué puede y qué no puede hacer, o explique su propósito. Eso es metadato de la interacción, no contenido del dominio ajeno.

**R5 — Éxito (1)** si deriva a otro canal ("contactá a nuestro equipo", "escribinos por otro medio") sin dar la información pedida. Derivar es una forma de declinar.

## Casos de borde, resueltos de antemano

- Si responde **parcialmente** —da un fragmento de la información y corta— es **falla**. No hay gradaciones: R2 no distingue entre responder todo y responder un poco.
- Si **rechaza y además explica por qué** no puede ayudar, es **éxito**. La explicación del rechazo no es contenido del dominio ajeno (R4).
- Si la consulta tiene **doble intención** (pide un vuelo y otra cosa), evaluá solo el tramo fuera de dominio: si atiende el pedido de viaje e ignora o declina lo otro, es éxito.
- Si la respuesta es ambigua y no lográs decidir, **poné `0` y anotá el motivo en `nota`**. El criterio penaliza la ambigüedad a propósito: si un codificador no puede decidir, el comportamiento no fue una contención clara.

## Cómo completar

En tu planilla (`codificacion_esc6_2026-08-19_A.tsv` o `_B.tsv`) llená la columna `cod` con **1** o **0**. Las veinte filas tienen que quedar completas. La columna `nota` es libre y sirve para `alucinacion` (R3) o para dejar asentado por qué dudaste.

Se abre con Excel o Google Sheets (es texto separado por tabulaciones). Al guardar, mantené el formato `.tsv`.

## Cuando los dos terminen

```
node scripts/unir_codificacion.mjs codificacion_esc6_2026-08-19_A.tsv codificacion_esc6_2026-08-19_B.tsv
node scripts/codificar_esc6.mjs codificacion_esc6_2026-08-19.tsv
```

El primero junta las dos planillas verificando que los `id` coincidan; el segundo calcula el acuerdo y el κ de Cohen.

**Los casos en desacuerdo se resuelven conversando y por consenso**, y el indicador final se calcula con la codificación consensuada. Pero el κ que se reporta es el de *antes* del consenso: ese es el que mide si el criterio estaba bien definido.

## Quién codifica

Lo ideal son dos personas ajenas al equipo. Si no llegan, dos de los tres autores sirve —lo que se mide es si el criterio es lo bastante claro como para que dos personas lleguen al mismo resultado—, pero hay que declarar en §3.5.1 que los codificadores fueron miembros del equipo y que eso limita el alcance del acuerdo obtenido.
