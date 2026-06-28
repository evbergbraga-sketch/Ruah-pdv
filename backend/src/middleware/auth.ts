import type { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { db } from '../db/client.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; tenantId: string; role: string; email: string }
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return reply.status(401).send({ error: 'Token não fornecido' })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return reply.status(401).send({ error: 'Token inválido' })

  const [user] = await db`
    SELECT id, tenant_id, role FROM users
    WHERE auth_id = ${data.user.id} AND ativo = true LIMIT 1
  `
  if (!user) return reply.status(403).send({ error: 'Usuário não autorizado' })

  req.user = { id: user.id, tenantId: user.tenant_id, role: user.role, email: data.user.email! }
}
