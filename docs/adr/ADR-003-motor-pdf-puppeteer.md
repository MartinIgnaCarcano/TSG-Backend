# ADR-003 — Motor de PDF: de PDFShift a Puppeteer local (con fallback a HTML)

**Fecha:** 2026-07-02
**Estado:** Aceptada (implementada)

## Contexto

Vouchers y contratos se generan a partir de HTML (`templates/voucher.template.ts`, `templates/contrato.template.ts`) y se entregan como PDF. La opción evaluada inicialmente fue **PDFShift**, un servicio externo con límites de uso y costo variable — depender de él introduce un punto de falla externo y un requisito de conectividad/pago justo antes de la demo o la defensa.

## Decisión

El motor por defecto es **Puppeteer** (Chromium embebido, corre local, sin API key ni servicio externo). PDFShift queda soportado pero opcional: si hay `PDFSHIFT_API_KEY` configurada, se usa esa; si no, se usa Puppeteer. Si Puppeteer no logra levantar Chromium (falta alguna dependencia del sistema en el entorno donde corre), como último recurso se guarda el HTML crudo en vez de romper la generación del documento.

Orden de preferencia en `lib/documentos.ts`: PDFShift (si hay key) → Puppeteer local → HTML crudo (solo si Puppeteer falla).

## Consecuencias

**Positivas:**
- No depende de internet ni de un signup/pago de último momento — el documento se genera igual durante la demo y la defensa, corriendo todo local.
- Renderiza un PDF real: los clientes de correo (Gmail, etc.) no muestran bien HTML crudo como adjunto, que era el comportamiento anterior sin key de PDFShift.
- Costo cero y sin límite de requests para las pruebas repetidas durante el desarrollo.

**Negativas / trade-offs:**
- Puppeteer necesita descargar y mantener un Chromium embebido, lo que hace el entorno de ejecución más pesado que delegar la conversión a un servicio externo.
- En entornos mínimos (ciertos contenedores) puede faltar una dependencia del sistema para levantar Chromium — por eso existe el fallback a HTML como último recurso, para no romper el flujo de emisión de documentos.
- Generar el PDF localmente consume más CPU/RAM por request que un servicio externo, aunque el volumen de la demo no lo hace relevante.
