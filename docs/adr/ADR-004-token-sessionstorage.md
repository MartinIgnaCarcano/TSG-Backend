# ADR-004 — Token de sesión en `sessionStorage` (vs. `localStorage` o cookie)

**Fecha:** 2026-07-02
**Estado:** Aceptada (implementada)

## Contexto

El front (React) necesita persistir el JWT del admin logueado para adjuntarlo como `Authorization: Bearer` en las llamadas autenticadas a la API. Las alternativas evaluadas fueron `localStorage`, una cookie (httpOnly o no) y `sessionStorage`.

## Decisión

El token se guarda en `sessionStorage` (clave `stg_token`, ver `lib/auth.tsx` del front), inyectado en el header `Authorization` por el interceptor de `apiClient`.

## Consecuencias

**Positivas:**
- El token no persiste entre pestañas ni se reutiliza automáticamente al reabrir el navegador (a diferencia de `localStorage`), lo que reduce la ventana de exposición si el dispositivo se comparte o queda desatendido.
- Evita la complejidad de un esquema de cookies httpOnly + CSRF en un backend que además atiende a n8n con `x-api-key` — más simple de implementar y depurar, sin configuración adicional de CORS con `credentials` ni `SameSite`.

**Negativas / trade-offs:**
- Sigue expuesto a XSS igual que `localStorage`: cualquier script que se ejecute en la página puede leerlo. Una cookie httpOnly sería más robusta específicamente ante ese vector, a costa de más complejidad en el backend.
- El usuario pierde la sesión al cerrar la pestaña o el navegador — limitación de UX aceptada a cambio de la reducción de superficie de ataque; queda documentada como decisión consciente, no como descuido.
