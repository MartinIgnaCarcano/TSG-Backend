# ADR-005 — Entrega de documentos por URL de capacidad firmada

**Fecha:** 2026-07-02
**Estado:** Aceptada (implementada, Fase S3)

## Contexto

Vouchers y contratos contienen datos personales de los pasajeros (DNI, fecha de nacimiento — Ley 25.326). Originalmente se servían como archivos estáticos públicos bajo `/storage/documentos`, sin expiración ni revocación: cualquiera que tuviera o adivinara el link podía descargarlos indefinidamente.

## Decisión

Se reemplaza el estático público por un endpoint dedicado `GET /api/documentos/:id/descargar?exp=<epoch>&sig=<hmac>`, donde `sig = HMAC-SHA256(id + exp, DOCS_URL_SECRET)`. El link se genera on-demand con `firmarUrlDocumento(id, ttlHoras = 72)` (`lib/documentos.ts`) cada vez que se consulta el documento — no se guarda un link fijo — y se valida con comparación en tiempo constante (`crypto.timingSafeEqual`) antes de streamear el archivo; fuera de eso, `403`/`410`. El `express.static('/storage/documentos')` se retira de `index.ts`. Este mismo link firmado es el que se manda por WhatsApp/email (`notificarDocumentoEmitido`) en vez de una URL directa.

## Consecuencias

**Positivas:**
- El link vence solo, sin necesidad de un mecanismo de revocación activa, y no se puede forjar sin conocer `DOCS_URL_SECRET`.
- Reduce la exposición de datos personales al mínimo necesario: nadie que no tenga el link firmado y vigente puede acceder al documento, en línea con la Ley 25.326.
- Al firmarse en el momento de cada consulta (no al generarse el documento), cada lectura del recurso obtiene un TTL fresco sin tocar el archivo en disco.

**Negativas / trade-offs:**
- No hay revocación granular por link individual — solo por vencimiento del TTL; si un link se filtra, sigue siendo válido hasta que expire (72 h por defecto).
- Toda la seguridad del esquema depende de que `DOCS_URL_SECRET` se mantenga secreto: si se filtra, cualquiera puede firmar URLs válidas para cualquier `id` de documento.
