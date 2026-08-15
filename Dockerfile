# Imagen de producción del backend STG.
#
# Por qué Docker y no el autodetector de Railway: el backend genera los PDF de
# vouchers y contratos con Puppeteer, que necesita un Chromium real y sus
# librerías de sistema. Con un Dockerfile eso queda declarado y reproducible;
# con nixpacks depende de heurísticas que cambian entre versiones.
#
# Estrategia: se instala el Chromium de Debian (apt) en lugar del que descarga
# Puppeteer. Es más liviano, se parchea con el sistema y evita el problema
# clásico de que el binario descargado no encuentre sus dependencias.

# ---------------------------------------------------------------- build ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Puppeteer no debe descargar su propio Chromium: usamos el de apt en runtime.
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npx tsc

# -------------------------------------------------------------- runtime ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      openssl ca-certificates \
      fonts-liberation fonts-dejavu-core \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Punto de montaje del volumen persistente de Railway. Sin volumen, los PDF
# generados se pierden en cada redespliegue.
RUN mkdir -p /app/storage/documentos

EXPOSE 3001

# Las migraciones se aplican al arrancar: es idempotente y evita que el
# esquema de Supabase quede atrás respecto del código desplegado.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
