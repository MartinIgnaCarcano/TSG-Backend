# API de Gestión de Viajes

**Base URL:** `http://localhost:3001`  
Todos los endpoints devuelven y reciben `Content-Type: application/json`.

---

## Arquitectura del bot de WhatsApp

El bot de WhatsApp **no corre dentro de este backend**. La orquestación
(recibir el mensaje, llamar al LLM, armar la comparativa de vuelos,
responder por WhatsApp) la hace **n8n** como workflow externo, con sus
propias credenciales de Twilio y Groq configuradas directo en n8n
(ver `SETUP_DEMO.md` en la raíz del proyecto).

Este backend solo expone los endpoints REST que esos workflows
consumen — por ejemplo `/api/calculadora/buscar`, `/api/reservas`,
`/api/parametros`, `/api/recordatorios`. No tiene ningún router de bot
montado en `src/index.ts`.

> Históricamente hubo una implementación del bot dentro de este repo
> (`src/bot/`, usando `groq-sdk` y `twilio` como dependencias directas).
> Se eliminó una vez migrada la orquestación a n8n, para no mantener
> dos implementaciones del mismo flujo. Si en algún momento n8n no
> estuviera disponible, esa versión vieja puede recuperarse del
> historial de git (commit previo a este cambio en la rama
> `feature/fase0-quickwins`).

---

## Autenticación

El login (`POST /api/admin-users/login`) **siempre** devuelve un JWT:

```json
{ "token": "...", "user": { "id": 1, "email": "...", "nombre": "..." } }
```

Pero ese token solo se **exige** si la variable de entorno
`AUTH_ENABLED=true`. Con `AUTH_ENABLED=false` (default, modo demo), la
API queda abierta como hasta ahora — ningún endpoint pide token.

Cuando `AUTH_ENABLED=true`, todas las rutas excepto `GET /api` (health)
y `POST /api/admin-users/login` exigen uno de estos dos headers:

- **Admins (front):** `Authorization: Bearer <token>` — el JWT que devuelve el login. Expira a las 8 h (`JWT_EXPIRES_IN`).
- **n8n (workflows):** `x-api-key: <N8N_API_KEY>` — una key fija, no es un JWT. Hay que configurar este mismo valor en los 5 workflows de n8n que llaman a esta API antes de activar `AUTH_ENABLED`.

El login también tiene rate limiting: **5 intentos cada 15 minutos por IP**.

Variables de entorno relevantes (ver `.env.example`): `JWT_SECRET`,
`JWT_EXPIRES_IN`, `AUTH_ENABLED`, `N8N_API_KEY`.

---

## Convenciones generales

- Los **DELETE** son siempre bajas lógicas — setean el campo `baja`, no eliminan el registro.
- Los campos `alta`, `modificacion` y `baja` son **solo de lectura** — no se envían en ningún body.
- Registros con `baja` distinto de `null` son considerados inactivos y no aparecen en los listados.
- **Fechas tipo `Date`** → `"YYYY-MM-DD"` (ej: `"2025-07-10"`)
- **Fechas tipo `DateTime`** → `"YYYY-MM-DDTHH:mm:ss"` (ej: `"2025-07-10T08:00:00"`)
- **Decimales** (precios, saldos) → número sin comillas (ej: `850.00`)
- `password_hash` **nunca** se devuelve en ninguna respuesta.

---

## Clientes

### Listar clientes activos
```
GET /api/clientes
```

### Ver cliente con sus reservas
```
GET /api/clientes/:id
```

### Crear cliente
```
POST /api/clientes
```
```json
{
  "nombre":           "Juan",
  "apellido":         "Pérez",
  "fechaNacimiento":  "1990-05-15",
  "dni":              "30123456",
  "telefono":         "+5491112345678",
  "email":            "juan@email.com",
  "nacionalidad":     "Argentina",
  "discapacidad":     false,
  "pasaporte":        "AAB123456",
  "yaViajo":          false
}
```
> `pasaporte` es opcional.

### Editar cliente
```
PUT /api/clientes/:id
```
Mismos campos que el POST. Todos opcionales.

### Dar de baja un cliente
```
DELETE /api/clientes/:id
```

---

## Viajes

### Listar viajes activos
Incluye tramos ordenados y cotizaciones.
```
GET /api/viajes
```

### Ver viaje por ID
```
GET /api/viajes/:id
```

### Crear viaje
Los tramos se pueden incluir directamente en la misma llamada.
```
POST /api/viajes
```
```json
{
  "lugarSalida":   "Mendoza",
  "lugarLlegada":  "Miami",
  "fechaSalida":   "2025-07-10",
  "fechaLlegada":  "2025-07-11",
  "tramos": [
    {
      "aeropuertoSalida":   "MDZ",
      "horarioSalida":      "2025-07-10T08:00:00",
      "aeropuertoLlegada":  "EZE",
      "horarioLlegada":     "2025-07-10T09:30:00",
      "orden":              1
    },
    {
      "aeropuertoSalida":   "EZE",
      "horarioSalida":      "2025-07-10T13:00:00",
      "aeropuertoLlegada":  "MIA",
      "horarioLlegada":     "2025-07-11T07:00:00",
      "orden":              2
    }
  ]
}
```
> `tramos` es opcional. Si no se incluye, el viaje se crea sin tramos y se agregan luego por `/api/tramos`.

### Editar viaje
Solo actualiza los campos del viaje, no los tramos.
```
PUT /api/viajes/:id
```
```json
{
  "lugarSalida":   "Mendoza",
  "lugarLlegada":  "Cancún",
  "fechaSalida":   "2025-08-01",
  "fechaLlegada":  "2025-08-02"
}
```

### Dar de baja un viaje
Baja en cascada: da de baja el viaje, todos sus tramos y todas sus cotizaciones.
```
DELETE /api/viajes/:id
```

---

## Tramos

### Listar tramos
```
GET /api/tramos
GET /api/tramos?viajeId=1
```

### Ver tramo por ID
Incluye el viaje al que pertenece.
```
GET /api/tramos/:id
```

### Crear tramo
```
POST /api/tramos
```
```json
{
  "aeropuertoSalida":   "MDZ",
  "horarioSalida":      "2025-07-10T08:00:00",
  "aeropuertoLlegada":  "EZE",
  "horarioLlegada":     "2025-07-10T09:30:00",
  "orden":              1,
  "viajeId":            3
}
```

### Editar tramo
```
PUT /api/tramos/:id
```
```json
{
  "aeropuertoSalida":   "MDZ",
  "horarioSalida":      "2025-07-10T09:00:00",
  "aeropuertoLlegada":  "EZE",
  "horarioLlegada":     "2025-07-10T10:30:00",
  "orden":              1
}
```

### Dar de baja un tramo
```
DELETE /api/tramos/:id
```

---

## Cotizaciones

### Listar cotizaciones
```
GET /api/cotizaciones
GET /api/cotizaciones?viajeId=1
```

### Ver cotización por ID
Incluye viaje con sus tramos.
```
GET /api/cotizaciones/:id
```

### Crear cotización
```
POST /api/cotizaciones
```
```json
{
  "aerolinea":       "Aerolíneas Argentinas",
  "precioDolares":   850.00,
  "precioPesos":     1020000.00,
  "cantidadValijas": 1,
  "clase":           "Económica",
  "viajeId":         3,
  "extra":           "Equipaje adicional 23kg",
  "extraPrecio":     75.00
}
```
> `extra` y `extraPrecio` son opcionales.

### Editar cotización
```
PUT /api/cotizaciones/:id
```
```json
{
  "aerolinea":       "LATAM",
  "precioDolares":   790.00,
  "precioPesos":     948000.00,
  "cantidadValijas": 2,
  "clase":           "Económica Premium",
  "extra":           null,
  "extraPrecio":     null
}
```

### Dar de baja una cotización
```
DELETE /api/cotizaciones/:id
```

---

## Reservas

### Listar reservas
Incluye cliente, cotizaciones y tramos de cada viaje.
```
GET /api/reservas
GET /api/reservas?clienteId=1
GET /api/reservas?finalizado=false
GET /api/reservas?clienteId=1&finalizado=false
```

### Ver reserva por ID
```
GET /api/reservas/:id
```

### Crear reserva
Al crear una reserva, el cliente queda marcado automáticamente con `yaViajo: true`.
```
POST /api/reservas
```
```json
{
  "clienteId":           1,
  "cotizacionIdaId":     2,
  "cotizacionVueltaId":  5,
  "saldoCliente":        850.00,
  "saldoVendedor":       50.00
}
```
> `cotizacionVueltaId` es opcional. Omitirlo si el viaje es solo de ida.

### Editar reserva
```
PUT /api/reservas/:id
```
```json
{
  "cotizacionIdaId":     2,
  "cotizacionVueltaId":  5,
  "saldoCliente":        900.00,
  "saldoVendedor":       55.00,
  "finalizado":          false
}
```

### Finalizar reserva
```
PATCH /api/reservas/:id/finalizar
```
Sin body. Setea `finalizado: true`.

### Dar de baja una reserva
```
DELETE /api/reservas/:id
```

---

## Admin Users

### Listar admins activos
Nunca devuelve `password_hash`.
```
GET /api/admin-users
```

### Ver admin por ID
```
GET /api/admin-users/:id
```

### Crear admin
La contraseña se hashea automáticamente antes de guardarse.
```
POST /api/admin-users
```
```json
{
  "email":    "admin@tuapp.com",
  "nombre":   "Nombre Admin",
  "password": "contraseña-segura-123"
}
```

### Login
```
POST /api/admin-users/login
```
```json
{
  "email":    "admin@tuapp.com",
  "password": "contraseña-segura-123"
}
```
Respuesta exitosa:
```json
{
  "id":     1,
  "email":  "admin@tuapp.com",
  "nombre": "Nombre Admin"
}
```

### Editar admin
Si se envía `password`, se re-hashea automáticamente.
```
PUT /api/admin-users/:id
```
```json
{
  "nombre":   "Nuevo Nombre",
  "email":    "nuevo@email.com",
  "password": "nueva-contraseña"
}
```
> Todos los campos son opcionales.

### Dar de baja un admin
```
DELETE /api/admin-users/:id
```

---

## Códigos de respuesta

| Código | Significado |
|--------|-------------|
| `200`  | OK |
| `201`  | Creado correctamente |
| `400`  | Error en los datos enviados |
| `401`  | Credenciales inválidas (solo login) |
| `404`  | Recurso no encontrado |
| `500`  | Error interno del servidor |

En caso de error, la respuesta tiene la forma:
```json
{
  "error": "Descripción del error"
}
```
