FROM node:20-alpine AS base

# Instalar dependencias del sistema necesarias para Prisma en Alpine Linux
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copiar archivos de dependencias y schema de Prisma
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instalar dependencias del proyecto
RUN npm ci

# Generar cliente de Prisma
RUN npx prisma generate

# Copiar el resto del código fuente
COPY . .

# Compilar aplicación Next.js para producción (Railway / VPS)
RUN npm run build

# Variables de entorno para Next.js en Docker
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Comando por defecto en producción (en local docker-compose usa npm run dev)
CMD ["sh", "-c", "npx prisma db push && node scripts/seed-if-empty.mjs && npm run start"]
