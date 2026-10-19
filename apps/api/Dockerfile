# API do O Gado (Fastify + Prisma). Contexto de build = raiz do monorepo (ver /railway.json).
FROM node:22-slim

# openssl: exigido pelo motor de migração do Prisma.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

WORKDIR /app
# Manifestos primeiro: a camada de instalação só refaz quando as dependências mudam.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
# Só a API e o que ela usa (db, contracts, domain); o lockfile congelado garante as mesmas versões.
RUN pnpm install --frozen-lockfile --filter "@ogado/api..."
COPY . .
RUN pnpm --filter @ogado/db exec prisma generate
RUN pnpm --filter @ogado/api build

ENV NODE_ENV=production
# A plataforma injeta PORT; o servidor lê PORT quando API_PORT não está definido.
EXPOSE 3001

# Migrações aditivas antes de subir (idempotente: `migrate deploy` só aplica o que falta).
CMD ["sh", "-c", "pnpm --filter @ogado/db exec prisma migrate deploy && node apps/api/dist/server.js"]
