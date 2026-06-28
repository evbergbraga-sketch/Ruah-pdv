# ── Stage 1: instala dependências ────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# ── Stage 2: compila TypeScript via esbuild ───────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx esbuild src/server.ts \
      --bundle \
      --platform=node \
      --format=esm \
      --target=node20 \
      --packages=external \
      --outfile=dist/server.js

# ── Stage 3: imagem final ──────────────────────────────────────
FROM node:20-alpine AS production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
USER app
EXPOSE 8010
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8010/health || exit 1
CMD ["node", "dist/server.js"]
