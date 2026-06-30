import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { db } from '../../db/client.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
})

const registroSchema = z.object({
  // Dados da empresa
  nomeEmpresa: z.string().min(2),
  cnpj: z.string().min(14),
  razaoSocial: z.string().min(2),
  telefone: z.string().optional(),
  // Dados do admin
  nomeAdmin: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
})

export async function authRoutes(app: FastifyInstance) {
  // Login — autentica no Supabase e retorna o token + dados do usuário
  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Email ou senha inválidos' })

    const { email, senha } = parsed.data

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error || !data.session) {
      return reply.status(401).send({ error: 'Email ou senha incorretos' })
    }

    const [user] = await db`
      SELECT u.id, u.nome, u.role, u.ativo, t.nome AS empresa, t.id AS tenant_id
      FROM users u JOIN tenants t ON t.id = u.tenant_id
      WHERE u.auth_id = ${data.user.id} LIMIT 1
    `

    if (!user) {
      return reply.status(403).send({ error: 'Usuário não vinculado a nenhuma empresa' })
    }
    if (!user.ativo) {
      return reply.status(403).send({ error: 'Usuário desativado. Contate o administrador.' })
    }

    return reply.send({
      token: data.session.access_token,
      user: {
        id: user.id,
        nome: user.nome,
        email,
        role: user.role,
        empresa: user.empresa,
        tenantId: user.tenant_id,
      },
    })
  })

  // Registro — cria empresa (tenant) + primeiro usuário admin
  app.post('/registro', async (req, reply) => {
    const parsed = registroSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() })

    const d = parsed.data
    const cnpjLimpo = d.cnpj.replace(/\D/g, '')

    // Verifica se o CNPJ já existe
    const [existente] = await db`SELECT id FROM tenants WHERE cnpj = ${d.cnpj}`
    if (existente) return reply.status(409).send({ error: 'Empresa com este CNPJ já cadastrada' })

    // Cria usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: d.email,
      password: d.senha,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return reply.status(400).send({ error: authError?.message ?? 'Erro ao criar usuário' })
    }

    try {
      const [tenant] = await db`
        INSERT INTO tenants(nome, cnpj, razao_social, email, telefone)
        VALUES(${d.nomeEmpresa}, ${d.cnpj}, ${d.razaoSocial}, ${d.email}, ${d.telefone ?? null})
        RETURNING *
      `

      const [user] = await db`
        INSERT INTO users(tenant_id, auth_id, nome, email, role)
        VALUES(${tenant.id}, ${authData.user.id}, ${d.nomeAdmin}, ${d.email}, 'admin')
        RETURNING *
      `

      return reply.status(201).send({
        empresa: tenant.nome,
        usuario: user.nome,
        mensagem: 'Empresa cadastrada com sucesso! Faça login para continuar.',
      })
    } catch (e) {
      // Rollback manual: se falhar ao criar tenant/user, remove o auth criado
      await supabase.auth.admin.deleteUser(authData.user.id)
      const msg = e instanceof Error ? e.message : 'Erro ao criar empresa'
      return reply.status(500).send({ error: msg })
    }
  })

  // Verifica sessão atual (usado pelo frontend ao recarregar a página)
  app.get('/me', async (req, reply) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return reply.status(401).send({ error: 'Token não fornecido' })

    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return reply.status(401).send({ error: 'Token inválido' })

    const [user] = await db`
      SELECT u.id, u.nome, u.role, u.ativo, t.nome AS empresa, t.id AS tenant_id
      FROM users u JOIN tenants t ON t.id = u.tenant_id
      WHERE u.auth_id = ${data.user.id} LIMIT 1
    `

    if (!user || !user.ativo) return reply.status(403).send({ error: 'Usuário inválido' })

    return reply.send({
      user: {
        id: user.id,
        nome: user.nome,
        email: data.user.email,
        role: user.role,
        empresa: user.empresa,
        tenantId: user.tenant_id,
      },
    })
  })
}
