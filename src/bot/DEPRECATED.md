# ⚠️ Módulo DESACTIVADO

Esta carpeta contiene un bot de WhatsApp que **ya no se usa**.
La orquestación del bot ahora la hace **n8n** (workflow externo).

## Cómo está desconectado

- `src/index.ts` ya no importa `./bot/twilio`
- `tsconfig.json` tiene `"exclude": [..., "src/bot"]` así TypeScript no compila esta carpeta
- El modelo `BotSesion` se quitó del `schema.prisma`

## ¿Para qué dejarlo?

Por si n8n falla y necesitás un bot funcional dentro del back, podés:
1. Sacar `"src/bot"` del `exclude` en `tsconfig.json`
2. Restaurar el import y `app.use('/api/bot', botRouter)` en `src/index.ts`
3. Restaurar el modelo `BotSesion` en `schema.prisma` y correr `npx prisma migrate dev`
4. Correr `npm install` (las deps `groq-sdk` y `twilio` siguen en `package.json`)

## Si querés borrarlo de verdad

```powershell
Remove-Item -Recurse -Force C:\Facultad\Tesis\Back\TSG-Backend\src\bot
```

Y opcionalmente sacá `groq-sdk` y `twilio` del `package.json` y `node_modules`.
