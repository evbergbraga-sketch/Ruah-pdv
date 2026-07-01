import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import { db } from './db/client.js'
import { pdvRoutes } from './modules/pdv/routes.js'
import { caixaRoutes } from './modules/caixa/routes.js'
import { fiscalRoutes } from './modules/fiscal/routes.js'
import { estoqueRoutes } from './modules/estoque/routes.js'
import { authRoutes } from './modules/auth/routes.js'
import { relatoriosRoutes } from './modules/relatorios/routes.js'

const isDev = false
const PORT = Number(process.env.PORT ?? 8010)

const app = Fastify({
  logger: {
    level: isDev ? 'debug' : 'info',
    ...(isDev && { transport: { target: 'pino-pretty', options: { colorize: true } } }),
  },
})

await app.register(helmet, { contentSecurityPolicy: false })
await app.register(cors, {
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3010'],
  credentials: true,
})
await app.register(rateLimit, { max: 200, timeWindow: '1 minute' })
await app.register(sensible)

// Health check real — testa conexão com banco
app.get('/health', async (_, reply) => {
  try {
    await db`SELECT 1`
    return reply.send({ ok: true, db: 'up', ts: new Date().toISOString() })
  } catch {
    return reply.status(503).send({ ok: false, db: 'down' })
  }
})

// Rotas públicas (sem autenticação)
await app.register(authRoutes, { prefix: '/api/auth' })

// Rotas protegidas (exigem token válido)
await app.register(pdvRoutes,     { prefix: '/api/pdv' })
await app.register(caixaRoutes,   { prefix: '/api/caixa' })
await app.register(fiscalRoutes,  { prefix: '/api/fiscal' })
await app.register(estoqueRoutes,    { prefix: '/api/estoque' })
await app.register(relatoriosRoutes, { prefix: '/api/relatorios' })

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`PDV API rodando em :${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
