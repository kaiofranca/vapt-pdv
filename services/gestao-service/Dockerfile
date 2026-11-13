# ==============================================================================
# Estágio 1: Builder (Compilação TypeScript + Prisma Client + Limpeza)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /build

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src/

RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev \
 && npm install --no-save --omit=dev prisma@^6.4.1 \
 && npx prisma generate \
 && rm -rf node_modules/prisma/build/public \
           node_modules/prisma/prisma-client \
           node_modules/prisma/*libquery_engine* \
           node_modules/prisma/*query_engine* \
           node_modules/prisma/*introspection* \
           node_modules/prisma/*prisma-fmt* \
           node_modules/prisma/build/*cockroachdb* \
           node_modules/prisma/build/*mysql* \
           node_modules/prisma/build/*sqlite* \
           node_modules/prisma/build/*sqlserver* \
           node_modules/prisma/build/query_compiler_bg.* \
           node_modules/prisma/build/query_engine_bg.* \
           node_modules/@prisma/client/generator-build \
           node_modules/@prisma/client/runtime/*cockroachdb* \
           node_modules/@prisma/client/runtime/*mysql* \
           node_modules/@prisma/client/runtime/*sqlite* \
           node_modules/@prisma/client/runtime/*sqlserver* \
           node_modules/@prisma/client/runtime/query_compiler_bg.* \
           node_modules/.prisma/client/query_engine_bg.* \
           node_modules/@prisma/engines/query_engine* \
           node_modules/@prisma/engines/libquery_engine* \
           node_modules/@prisma/engines/introspection-engine* \
           node_modules/@prisma/engines/prisma-fmt* \
           node_modules/typescript \
           node_modules/effect/src \
           node_modules/effect/dist/esm \
           node_modules/@esbuild \
           node_modules/@types \
           node_modules/@vitest \
 && find node_modules dist -type f \( -name "*.d.ts" -o -name "*.d.mts" -o -name "*.d.ts.map" -o -name "*.js.map" -o -name "*.mjs.map" -o -name "*.ts.map" \) -delete

# ==============================================================================
# Estágio 2: Runner (Imagem final enxuta < 160MB, usuário não-root)
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* \
 && printf '#!/bin/sh\nif [ "$1" = "prisma" ]; then\n  shift\n  exec node /app/node_modules/prisma/build/index.js "$@"\nelse\n  exec "$@"\nfi\n' > /usr/local/bin/npx \
 && chmod +x /usr/local/bin/npx

ENV NODE_ENV=production \
    PORT=3003

COPY --from=builder --chown=node:node /build/package.json ./
COPY --from=builder --chown=node:node /build/node_modules ./node_modules
COPY --from=builder --chown=node:node /build/dist ./dist
COPY --from=builder --chown=node:node /build/prisma ./prisma

USER node

EXPOSE 3003

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3003/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
