import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db/client.js'
import { supabase } from '../lib/supabase.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; tenantId: string; role: string; email: string }
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return reply.status(401).send({ error: 'Token não fornecido' })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return reply.status(401).send({ error: 'Token inválido ou expirado' })

  const [user] = await db`
    SELECT id, tenant_id, role, ativo FROM users
    WHERE auth_id = ${data.user.id} LIMIT 1
  `

  if (!user) return reply.status(403).send({ error: 'Usuário não vinculado a nenhuma empresa' })
  if (!user.ativo) return reply.status(403).send({ error: 'Usuário desativado' })

  req.user = {
    id: user.id,
    tenantId: user.tenant_id,
    role: user.role,
    email: data.user.email!,
  }
}
