import type { FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; tenantId: string; role: string; email: string }
  }
}

// Auth temporário — JWT + Supabase será adicionado após o sistema estar rodando
export async function authenticate(req: FastifyRequest, _reply: FastifyReply) {
  // Tenant fixo para o primeiro estabelecimento
  req.user = {
    id: '00000000-0000-0000-0000-000000000001',
    tenantId: '00000000-0000-0000-0000-000000000001',
    role: 'admin',
    email: 'admin@bellamakeup.com.br',
  }
}
