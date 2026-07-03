# Fase S6 — Smoke test con AUTH_ENABLED=true

**Fecha:** 2026-07-02
**Objetivo:** demostrar que encender la autenticación es "girar una llave" y no una refactorización — la demo corre con `AUTH_ENABLED=false` a propósito, pero el código ya soporta auth encendida sin romper nada.

## Entorno de prueba

Réplica del backend (mismo `src/`, mismo `prisma/schema.prisma`, mismas migraciones) corriendo contra una instancia de Postgres efímera, con:

```
AUTH_ENABLED=true
N8N_API_KEY=47e7b5c2a411bac09ad3ca5c29f97213bf2e7d7fdaa00eae   (la misma que .env)
JWT_SECRET=<la misma que .env>
```

Datos: `prisma migrate` (las 8 migraciones existentes) + `prisma/seed.ts` corridos limpios contra la base de prueba (admin `admin@stg.com` / `admin123`, cotizaciones/reservas/hoteles de ejemplo).

## Resultado — 9/9 casos OK

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| 1 | `GET /api` sin ningún header | 200 (ruta pública) | ✅ `200` |
| 2 | `GET /api/cotizaciones` sin credencial | 401 | ✅ `401 "Falta autenticación (Bearer token o x-api-key)"` |
| 3 | `GET /api/cotizaciones` con `x-api-key` correcta (simula un flujo n8n, ej. Flujo2) | 200 + datos | ✅ `200`, devuelve las 5 cotizaciones seed |
| 4 | `GET /api/cotizaciones` con `x-api-key` inválida | 401 | ✅ `401 "API key inválida"` |
| 5 | `POST /api/admin-users/login` con `admin@stg.com` / `admin123` | 200 + JWT | ✅ `200`, token emitido |
| 6 | `GET /api/admin-users` con el Bearer del paso 5 | 200 | ✅ `200`, devuelve el admin |
| 7 | `POST /api/admin-users` con `x-api-key` (sin Bearer) — **Fase S6.2** | 401, no debe poder crear admins vía API key | ✅ `401 "Esta operación requiere una sesión de administrador (Bearer token); no acepta x-api-key"` |
| 8 | `POST /api/admin-users` con el Bearer del paso 5 | 201 | ✅ `201`, admin creado |
| 9 | `POST /api/admin-users` sin ningún header | 401 | ✅ `401 "Falta autenticación..."` |

## Conclusión

Con `AUTH_ENABLED=true`:
- Las rutas de negocio (representadas por `/api/cotizaciones`) quedan protegidas y n8n puede seguir pegándole con el header `x-api-key` que ya se agregó a los nodos HTTP/Code de los 7 workflows (Fase S6.1).
- El login de admins sigue funcionando igual y emite un JWT usable.
- La gestión de admins (alta/edición/baja) **ya no acepta la `x-api-key` de n8n** — exige sesión de admin logueado (Fase S6.2, `requireAdminBearer` en `middleware/auth.ts`), cerrando el vector de "un workflow filtrado crea un admin nuevo".
- Un request sin ninguna credencial a una ruta protegida siempre devuelve `401`.

**Respuesta lista para la P1 del jurado:** "la auth está apagada en la demo por decisión consciente (modo demo), y esta tabla es la evidencia de que encendida (`AUTH_ENABLED=true`) funciona sin romper ni el front, ni los workflows de n8n, ni el flujo de admins."
