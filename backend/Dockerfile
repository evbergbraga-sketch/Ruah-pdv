FROM node:20-alpine AS deps
WORKDIR /build
COPY package*.json ./
RUN npm ci --only=production && cp -r node_modules /prod_nm
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /build
COPY --from=deps /build/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS development
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=deps /build/node_modules ./node_modules
COPY . .
USER app
EXPOSE 8010
CMD ["npm","run","dev"]

FROM node:20-alpine AS production
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=deps /prod_nm ./node_modules
COPY --from=builder /build/dist ./dist
COPY package.json ./
USER app
EXPOSE 8010
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8010/health || exit 1
CMD ["node","dist/server.js"]
