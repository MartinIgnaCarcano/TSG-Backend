# ADR-001 — n8n como orquestador del bot (vs. bot embebido en Express)

**Fecha:** 2026-07-02
**Estado:** Aceptada (implementada)

## Contexto

El bot de WhatsApp necesita: recibir webhooks de Twilio, mantener memoria conversacional por usuario, llamar a un LLM (Llama 3.3 vía Groq) con un AI Agent, orquestar varios pasos externos (buscar vuelos en RapidAPI/Google Flights, comparar 3 fechas, crear cliente/viaje/cotización contra el backend, enviar la respuesta por WhatsApp y el detalle por email), y tolerar cambios frecuentes de lógica conversacional durante el desarrollo de la tesis sin frenar el resto del sistema.

## Decisión

Se usa **n8n** (self-hosted) como orquestador de todo el flujo del bot, en vez de programarlo directamente dentro de `TSG-Backend` (Express). El backend queda reducido a una **API REST de dominio** (clientes, destinos, viajes, cotizaciones, reservas, pagos, documentos); n8n consume esa API autenticándose con `x-api-key` (Fase S6).

## Consecuencias

**Positivas:**
- Iteración rápida sobre la lógica conversacional (prompts, ramas del flujo, formato de mensajes) editando el workflow, sin recompilar ni redeployar el backend.
- Nodos de LangChain ya integrados (`AI Agent`, `memoryBufferWindow`, `lmChatGroq`) — no hay que escribir un cliente de LLM ni un gestor de contexto a mano.
- Separación de responsabilidades: el backend es la única fuente de verdad del dominio (estados de reserva, saldos, documentos) y no conoce nada de WhatsApp/Twilio; el bot no conoce reglas de negocio, solo llama a la API.

**Negativas / trade-offs:**
- Un componente más para desplegar, versionar y respaldar (el JSON exportado en `workflows/`), además del backend.
- La autenticación n8n → backend depende de una `x-api-key` compartida por todos los workflows en vez de credenciales por flujo (ver Fase S6, que documenta cómo encenderlo sin romper nada).
- Debugging distribuido: un fallo puede originarse en un nodo de n8n, en el prompt del LLM, en una API externa (RapidAPI, Twilio) o en el backend — hay que revisar varias capas.
