FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /build/backend

COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src/
RUN npx prisma generate \
 && npm run build \
 && npm prune --omit=dev \
 && npm install --no-save --omit=dev prisma@^6.4.1 \
 && npx prisma generate \
 && rm -rf node_modules/prisma/build/public \
           node_modules/prisma/*query_engine* \
           node_modules/@prisma/engines/*query_engine* \
           node_modules/@prisma/engines/*introspection* \
           node_modules/@prisma/engines/*prisma-fmt* \
 && find node_modules \( -name "*.d.ts" -o -name "*.d.ts.map" -o -name "*.js.map" -o -name "*.ts.map" \) -delete

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /opt/yarn* \
 && printf '#!/bin/sh\nif [ "$1" = "prisma" ]; then\n  shift\n  exec node /app/node_modules/prisma/build/index.js "$@"\nelse\n  exec "$@"\nfi\n' > /usr/local/bin/npx \
 && chmod +x /usr/local/bin/npx

COPY --from=backend-builder --chown=node:node /build/backend/package.json ./package.json
COPY --from=backend-builder --chown=node:node /build/backend/node_modules ./node_modules
COPY --from=backend-builder --chown=node:node /build/backend/dist ./dist
COPY --from=backend-builder --chown=node:node /build/backend/prisma ./prisma
COPY --from=frontend-builder --chown=node:node /build/frontend/dist ./public

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
