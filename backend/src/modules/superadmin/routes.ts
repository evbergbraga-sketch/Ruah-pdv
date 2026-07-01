import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, withTenant } from '../../db/client.js'
import { supabase } from '../../lib/supabase.js'
import { authenticateSuperAdmin } from '../../middleware/superadmin.js'

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
})

const criarEmpresaSchema = z.object({
  nomeEmpresa: z.string().min(2),
  cnpj: z.string().min(14),
  razaoSocial: z.string().min(2),
  telefone: z.string().optional(),
  nomeAdmin: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  plano: z.string().default('basico'),
  limiteUsuarios: z.number().int().min(1).max(999).default(3),
  permiteCrm: z.boolean().default(true),
  permiteMensagens: z.boolean().default(false),
  permiteCupomFiscal: z.boolean().default(false),
})

const editarEmpresaSchema = z.object({
  ativo: z.boolean().optional(),
  plano: z.string().optional(),
  limiteUsuarios: z.number().int().min(1).max(999).optional(),
  permiteCrm: z.boolean().optional(),
  permiteMensagens: z.boolean().optional(),
  permiteCupomFiscal: z.boolean().optional(),
})

export async function superadminRoutes(app: FastifyInstance) {
  // Login — rota pública, separada do login normal de tenant
  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Email ou senha inválidos' })

    const { email, senha } = parsed.data
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error || !data.session) return reply.status(401).send({ error: 'Email ou senha incorretos' })

    const [admin] = await db`SELECT id, nome, email FROM super_admins WHERE auth_id = ${data.user.id} LIMIT 1`
    if (!admin) return reply.status(403).send({ error: 'Acesso restrito ao super admin' })

    return reply.send({
      token: data.session.access_token,
      admin: { id: admin.id, nome: admin.nome, email: admin.email },
    })
  })

  app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', authenticateSuperAdmin)

    // Verifica sessão atual
    protectedApp.get('/me', async (req, reply) => {
      return reply.send({ admin: { nome: req.superAdmin.nome, email: req.superAdmin.email } })
    })

    // Lista todas as empresas com contagem de usuários
    protectedApp.get('/empresas', async (req, reply) => {
      const empresas = await db`
        SELECT id, nome, cnpj, razao_social, email, telefone, plano, ativo,
               limite_usuarios, permite_crm, permite_mensagens, permite_cupom_fiscal,
               created_at
        FROM tenants ORDER BY created_at DESC
      `
      const contagens = await db`SELECT * FROM superadmin_contagem_usuarios(${req.superAdmin.authId})`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapaContagem = new Map((contagens as any[]).map(c => [c.tenant_id, Number(c.qtd_usuarios)]))

      return reply.send({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        empresas: (empresas as any[]).map(e => ({
          id: e.id, nome: e.nome, cnpj: e.cnpj, razaoSocial: e.razao_social,
          email: e.email, telefone: e.telefone, plano: e.plano, ativo: e.ativo,
          limiteUsuarios: e.limite_usuarios, permiteCrm: e.permite_crm,
          permiteMensagens: e.permite_mensagens, permiteCupomFiscal: e.permite_cupom_fiscal,
          qtdUsuarios: mapaContagem.get(e.id) ?? 0,
          createdAt: e.created_at,
        })),
      })
    })

    // Cria empresa (tenant) + primeiro usuário admin
    protectedApp.post('/empresas', async (req, reply) => {
      const parsed = criarEmpresaSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() })

      const d = parsed.data
      const [existente] = await db`SELECT id FROM tenants WHERE cnpj = ${d.cnpj}`
      if (existente) return reply.status(409).send({ error: 'Empresa com este CNPJ já cadastrada' })

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: d.email, password: d.senha, email_confirm: true,
      })
      if (authError || !authData.user) {
        return reply.status(400).send({ error: authError?.message ?? 'Erro ao criar usuário' })
      }

      try {
        const [tenant] = await db`
          INSERT INTO tenants(
            nome, cnpj, razao_social, email, telefone, plano,
            limite_usuarios, permite_crm, permite_mensagens, permite_cupom_fiscal
          )
          VALUES(
            ${d.nomeEmpresa}, ${d.cnpj}, ${d.razaoSocial}, ${d.email}, ${d.telefone ?? null}, ${d.plano},
            ${d.limiteUsuarios}, ${d.permiteCrm}, ${d.permiteMensagens}, ${d.permiteCupomFiscal}
          )
          RETURNING *
        `

        // INSERT em `users` passa pela RLS tenant_iso — precisa do contexto
        // do tenant recém-criado na mesma transação.
        await withTenant(tenant.id, async (tx) => tx`
          INSERT INTO users(tenant_id, auth_id, nome, email, role)
          VALUES(${tenant.id}, ${authData.user.id}, ${d.nomeAdmin}, ${d.email}, 'admin')
        `)

        return reply.status(201).send({ empresa: tenant.nome, mensagem: 'Empresa criada com sucesso!' })
      } catch (e) {
        await supabase.auth.admin.deleteUser(authData.user.id)
        const msg = e instanceof Error ? e.message : 'Erro ao criar empresa'
        return reply.status(500).send({ error: msg })
      }
    })

    // Edita features, limites, plano ou status de uma empresa
    protectedApp.patch('/empresas/:id', async (req, reply) => {
      const { id } = req.params as { id: string }
      const parsed = editarEmpresaSchema.safeParse(req.body)
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() })

      const d = parsed.data
      const [tenant] = await db`
        UPDATE tenants SET
          ativo               = COALESCE(${d.ativo ?? null}, ativo),
          plano               = COALESCE(${d.plano ?? null}, plano),
          limite_usuarios      = COALESCE(${d.limiteUsuarios ?? null}, limite_usuarios),
          permite_crm          = COALESCE(${d.permiteCrm ?? null}, permite_crm),
          permite_mensagens    = COALESCE(${d.permiteMensagens ?? null}, permite_mensagens),
          permite_cupom_fiscal = COALESCE(${d.permiteCupomFiscal ?? null}, permite_cupom_fiscal)
        WHERE id = ${id}
        RETURNING id
      `
      if (!tenant) return reply.status(404).send({ error: 'Empresa não encontrada' })
      return reply.send({ ok: true })
    })
  })
}
