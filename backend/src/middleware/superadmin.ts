import type { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db/client.js'
import { supabase } from '../lib/supabase.js'

declare module 'fastify' {
  interface FastifyRequest {
    superAdmin: { id: string; authId: string; nome: string; email: string }
  }
}

export async function authenticateSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return reply.status(401).send({ error: 'Token não fornecido' })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return reply.status(401).send({ error: 'Token inválido ou expirado' })

  const [admin] = await db`
    SELECT id, nome, email FROM super_admins WHERE auth_id = ${data.user.id} LIMIT 1
  `

  if (!admin) return reply.status(403).send({ error: 'Acesso restrito ao super admin' })

  req.superAdmin = { id: admin.id, authId: data.user.id, nome: admin.nome, email: admin.email }
}
