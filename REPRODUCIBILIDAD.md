# Paquete de replicación — Tesis STG

> *Automatización y optimización de procesos de comercio electrónico en una agencia de viajes mediante la plataforma low-code n8n*
> Emanuel Pérez Gianolini · Martín Carcano · Andrés Salattino — UTN FRM, 2026

Este documento permite a un tercero **reproducir y verificar** los resultados empíricos del Capítulo 5 de la tesis. Cubre el hallazgo **C-4** de la auditoría académica: la reproducibilidad se afirmaba en el §3.8 y en el §3.6.1 sin consignar la dirección del repositorio ni adjuntar los artefactos necesarios.

---

## 1 · Qué contiene este paquete

| Artefacto | Ubicación | Qué sustenta |
|---|---|---|
| Esquema DDL ejecutable (13 tablas) | `docs/schema.sql` | §4.2.1, Tabla 6, Figura 3 |
| Migraciones versionadas | `prisma/migrations/` | evolución del modelo |
| Modelo de datos canónico | `prisma/schema.prisma` | §4.2.1 |
| Contrato formal de la API (73 operaciones) | `docs/openapi.yaml` | §4.2.2, Tabla 7 |
| Flujo de orquestación exportado | `workflows/Bot_STG_Twilio_n8n.json` | §4.3, §4.4, Anexo B |
| Flujo con correcciones de auditoría | `workflows/Bot_STG_Twilio_n8n.CORREGIDO.json` | M-9, M-10, M-11 |
| Script de validación del agente | `scripts/validar_agente.mjs` | §5.1, Tabla 8 |
| Transcripción auditable de los diálogos | `scripts/validacion_agente_transcript.txt` | §5.1 — **evidencia primaria** |
| Prueba de persistencia (6 verificaciones) | `scripts/test_persistencia.mjs` | §5.3 |
| Prueba de la máquina de estados | `scripts/test_maquina_estados.mjs` | §4.2.2, §5.3 (A-11) |
| Prueba de concurrencia | `scripts/test_concurrencia.mjs` | §6.1 (M-17) |
| Medición de latencia extremo a extremo | `scripts/medir_latencia_e2e.mjs` | §5.2 (C-1) |
| Medición de latencia del motor | `scripts/medir_latencia.mjs` | §5.2 |
| Tests unitarios (32 casos) | `src/services/reservas.service.test.ts` | §4.2.2 |
| Decisiones de arquitectura | `docs/adr/ADR-001..005` | §2.7, §4.1 |
| Análisis de amenazas STRIDE | `docs/ANALISIS_AMENAZAS_STRIDE.md` | §3.7, §4.2.2 |
| Diagrama de estados | `docs/diagrama_estados_reserva.mermaid` | §4.2.2 |
| Matriz de transiciones | `docs/modelado/matriz_transiciones_reserva.md` | §4.2.2 (A-11) |
| BPMN as-is / to-be | `docs/modelado/proceso_*.bpmn` | §1.1, §4 (A-10) |
| Diagrama de secuencia | `docs/modelado/secuencia_cotizacion_reserva.mermaid` | §4.3 (A-10) |

---

## 2 · Requisitos

- **Node.js** ≥ 18 (usa `fetch` nativo)
- **Docker** (o PostgreSQL 16 local)
- **Claves de terceros**, cada una en su plan gratuito:
  - `RAPIDAPI_KEY` — proveedor `google-flights2` en RapidAPI
  - `GROQ_API_KEY` — inferencia de Llama 3.3
  - Credenciales de Twilio (solo para el modo con WhatsApp real)

> Ninguna clave está incluida en este repositorio. `.env` no está versionado; `.env.example` documenta las variables con valores vacíos.

---

## 3 · Puesta en marcha

```bash
# 1 · Base de datos
docker run --name stg-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=stg \
  -p 5432:5432 -d postgres:16

# 2 · Backend
cp .env.example .env          # completar DATABASE_URL y RAPIDAPI_KEY
npm install
npx prisma migrate deploy
npm run seed
npm run dev                   # queda escuchando en http://localhost:3001
```

Verificación rápida:

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/parametros   # debe devolver USD_OFICIAL y USD_BLUE
```

Para el flujo completo con WhatsApp, seguir además los pasos 3 y 4 de `SETUP_DEMO.md` (n8n en Docker + importación de los workflows + ngrok).

---

## 4 · Reproducción de cada resultado

### 4.1 · Precisión de extracción — §5.1, Tabla 8

```bash
GROQ_API_KEY=gsk_xxx node scripts/validar_agente.mjs
```

Corre los 23 diálogos de los 6 escenarios contra el **mismo modelo de producción** y el **system prompt exacto leído del workflow**, aplica el criterio binario de la Tabla 5b y guarda la transcripción completa en `scripts/validacion_agente_transcript.txt`.

**Salida esperada:** 21/21 en los escenarios 1 a 5. Los 2 diálogos del Escenario 6 se marcan como `⚠️ REVISAR`: su criterio exige juicio humano, porque hay que determinar si el agente respondió de manera sustantiva a la consulta fuera de dominio antes de reconducir. En la corrida reportada en la tesis ambos se codificaron como falla, dando 21/23 sobre el total.

> ⚠️ **Nota de reproducibilidad.** El modelo es generativo con `temperature = 0.2`: las respuestas literales varían entre corridas aunque el veredicto binario sea estable. La transcripción adjunta corresponde a la corrida reportada, fechada en su encabezado.

### 4.2 · Latencia — §5.2

```bash
# Componente del motor de cotización (lo que reporta la versión original)
node scripts/medir_latencia.mjs

# Extremo a extremo, dos condiciones (corrige el hallazgo C-1)
GROQ_API_KEY=gsk_xxx RUNS=5 node scripts/medir_latencia_e2e.mjs

# Incluyendo el orquestador completo
MODO=n8n N8N_WEBHOOK_URL=https://xxx.ngrok.io/webhook/bot node scripts/medir_latencia_e2e.mjs
```

Deja `evidencia/latencia_e2e_<fecha>.csv` con el registro por corrida en milisegundos.

> ⚠️ Si la búsqueda devuelve 0 opciones, la cuota mensual de la API tarifaria está agotada y **los tiempos no son representativos**. El script lo avisa.

### 4.3 · Consistencia de persistencia — §5.3

```bash
node scripts/test_persistencia.mjs
```

25 transacciones (altas, consultas, modificaciones y bajas lógicas) sobre todas las entidades, más **6 verificaciones de integridad referencial**: asociación de la reserva con sus pasajeros, asociación con sus pagos, conciliación del saldo, transición automática a `PAGADA`, propagación en cascada de la baja lógica y ausencia de registros dados de baja en las listas de activos.

### 4.4 · Máquina de estados — §4.2.2, §5.3

```bash
node scripts/test_maquina_estados.mjs   # integración: recorre la matriz completa
npm test                                # unitarios: 32 casos con vitest
```

Recorre los 42 pares de estados posibles y verifica que las **14 transiciones permitidas** se acepten y las **28 prohibidas** se rechacen con 4xx.

### 4.5 · Concurrencia — §6.1

```bash
N=10 node scripts/test_concurrencia.mjs
```

Cuatro escenarios concurrentes: pagos simultáneos sobre una misma reserva, transiciones de estado en competencia, altas simultáneas sobre un mismo viaje y lecturas concurrentes durante escrituras.

---

## 5 · Versión descrita en la tesis

| | Tesis (Tabla 7) | Este repositorio |
|---|---|---|
| Rutas | ~70 sobre 14 recursos | **73 operaciones sobre 16 recursos** |
| Entidades | 13 | 13 |

La diferencia se debe a la evolución posterior a la redacción (endpoints de estadísticas y salud). **Al publicar, fijar el commit o tag que corresponde a la versión evaluada** y citarlo en el §4.2.2 para que el recuento de la Tabla 7 sea verificable.

---

## 6 · Limitaciones de la replicación

Un tercero puede reproducir la arquitectura, el modelo de datos, los flujos y las pruebas de persistencia, concurrencia y máquina de estados de forma determinista. **No** puede reproducir de manera idéntica:

- **Las respuestas del modelo de lenguaje.** Generación estocástica; el veredicto binario es estable, el texto no.
- **Los tiempos de la búsqueda tarifaria.** Dependen de un proveedor de terceros sin acuerdo de nivel de servicio, cuya latencia y disponibilidad varían entre corridas. Es la amenaza de instrumentación declarada en el §6.3.
- **La línea de base manual de 15–40 minutos.** Es una estimación declarada por la agencia colaboradora, no una medición independiente (hallazgo A-2).

---

## 7 · Cómo citar

```
Pérez Gianolini, E., Carcano, M., y Salattino, A. (2026). Paquete de replicación —
Automatización y optimización de procesos de comercio electrónico en una agencia de
viajes mediante la plataforma low-code n8n [Software y datos]. Zenodo.
https://doi.org/10.5281/zenodo.XXXXXXX
```

> Completar el DOI tras publicar la *release* en Zenodo, y citar esta entrada en el §3.6.1, el §3.8 y el Anexo D.

---

## 8 · Licencia

Código bajo licencia MIT. Datos de validación bajo CC-BY-4.0. Los datos personales que aparecen en seeds, transcripciones y capturas son **sintéticos**: ningún dato real de clientes de la agencia colaboradora se incluye en este paquete.
