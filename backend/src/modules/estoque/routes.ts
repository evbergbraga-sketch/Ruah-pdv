import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { withTenant } from '../../db/client.js'
import { authenticate } from '../../middleware/auth.js'

const produtoSchema = z.object({
  nome:           z.string().min(1),
  ean:            z.string().optional(),
  codigo:         z.string().optional(),
  preco_venda:    z.number().positive(),
  preco_custo:    z.number().min(0).default(0),
  unidade:        z.string().default('UN'),
  ncm:            z.string().default('33049900'),
  cfop:           z.string().default('5102'),
  cst:            z.string().default('400'),
  aliq_icms:      z.number().min(0).default(0),
  estoque_minimo: z.number().int().min(0).default(5),
  estoque_inicial:z.number().int().min(0).default(0),
})

export async function estoqueRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // Atualizar produto
  app.patch('/produtos/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = produtoSchema.partial().safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() })

    const d = parsed.data
    const produto = await withTenant(req.user.tenantId, async (tx) => {
      const [p] = await tx`
        UPDATE produtos SET
          nome = COALESCE(${d.nome ?? null}, nome),
          ean = ${d.ean ?? null},
          codigo = ${d.codigo ?? null},
          preco_venda = COALESCE(${d.preco_venda ?? null}, preco_venda),
          preco_custo = COALESCE(${d.preco_custo ?? null}, preco_custo),
          unidade = COALESCE(${d.unidade ?? null}, unidade),
          ncm = COALESCE(${d.ncm ?? null}, ncm),
          cfop = COALESCE(${d.cfop ?? null}, cfop),
          cst = COALESCE(${d.cst ?? null}, cst),
          estoque_minimo = COALESCE(${d.estoque_minimo ?? null}, estoque_minimo),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `
      return p
    })

    if (!produto) return reply.status(404).send({ error: 'Produto não encontrado' })
    return reply.send({ produto })
  })

  // Desativar produto
  app.delete('/produtos/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await withTenant(req.user.tenantId, async (tx) => tx`
      UPDATE produtos SET ativo = false, updated_at = NOW() WHERE id = ${id}
    `)
    return reply.send({ ok: true })
  })

  // Criar produto
  app.post('/produtos', async (req, reply) => {
    const parsed = produtoSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() })

    const d = parsed.data
    const produto = await withTenant(req.user.tenantId, async (tx) => {
      const [p] = await tx`
        INSERT INTO produtos(tenant_id, nome, ean, codigo, preco_venda, preco_custo,
          unidade, ncm, cfop, cst, aliq_icms, estoque_minimo)
        VALUES(${req.user.tenantId}, ${d.nome}, ${d.ean ?? null}, ${d.codigo ?? null},
          ${d.preco_venda}, ${d.preco_custo}, ${d.unidade}, ${d.ncm}, ${d.cfop},
          ${d.cst}, ${d.aliq_icms}, ${d.estoque_minimo})
        RETURNING *
      `

      // Cria registro de estoque
      await tx`
        INSERT INTO estoque(produto_id, tenant_id, quantidade)
        VALUES(${p.id}, ${req.user.tenantId}, ${d.estoque_inicial})
      `

      // Se houver estoque inicial, registra movimento
      if (d.estoque_inicial > 0) {
        await tx`
          INSERT INTO estoque_movimentos(tenant_id, produto_id, tipo, quantidade, qtd_antes, motivo)
          VALUES(${req.user.tenantId}, ${p.id}, 'entrada', ${d.estoque_inicial}, 0, 'Estoque inicial')
        `
      }

      return p
    })

    return reply.status(201).send({ produto })
  })

  // Listar produtos com estoque
  app.get('/produtos', async (req, reply) => {
    const { q } = req.query as { q?: string }

    const produtos = await withTenant(req.user.tenantId, async (tx) => {
      if (q?.trim()) {
        return tx`
          SELECT p.*, e.quantidade AS estoque, c.nome AS categoria
          FROM produtos p
          LEFT JOIN estoque e ON e.produto_id = p.id
          LEFT JOIN categorias c ON c.id = p.categoria_id
          WHERE p.ativo = true AND (
            p.nome ILIKE ${'%' + q + '%'} OR
            p.ean  ILIKE ${'%' + q + '%'} OR
            p.codigo ILIKE ${'%' + q + '%'}
          )
          ORDER BY p.nome
        `
      }
      return tx`
        SELECT p.*, e.quantidade AS estoque, c.nome AS categoria
        FROM produtos p
        LEFT JOIN estoque e ON e.produto_id = p.id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.ativo = true
        ORDER BY p.nome
      `
    })

    return reply.send({ produtos })
  })

  // Atualizar estoque (entrada manual)
  app.post('/produtos/:id/entrada', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { quantidade, motivo } = req.body as { quantidade: number; motivo?: string }

    if (!quantidade || quantidade <= 0) {
      return reply.status(400).send({ error: 'Quantidade inválida' })
    }

    await withTenant(req.user.tenantId, async (tx) => {
      const [atual] = await tx`SELECT quantidade FROM estoque WHERE produto_id = ${id}`
      const qtdAntes = atual?.quantidade ?? 0

      await tx`UPDATE estoque SET quantidade = quantidade + ${quantidade}, updated_at = NOW() WHERE produto_id = ${id}`

      await tx`
        INSERT INTO estoque_movimentos(tenant_id, produto_id, tipo, quantidade, qtd_antes, motivo, user_id)
        VALUES(${req.user.tenantId}, ${id}, 'entrada', ${quantidade}, ${qtdAntes}, ${motivo ?? 'Entrada manual'}, ${req.user.id})
      `
    })

    return reply.send({ ok: true })
  })

  // Saída manual (perda, quebra, ajuste negativo)
  app.post('/produtos/:id/saida', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { quantidade, motivo } = req.body as { quantidade: number; motivo?: string }

    if (!quantidade || quantidade <= 0) {
      return reply.status(400).send({ error: 'Quantidade inválida' })
    }

    await withTenant(req.user.tenantId, async (tx) => {
      const [atual] = await tx`SELECT quantidade FROM estoque WHERE produto_id = ${id}`
      const qtdAntes = atual?.quantidade ?? 0

      if (qtdAntes < quantidade) {
        throw new Error(`Estoque insuficiente: disponível ${qtdAntes}, solicitado ${quantidade}`)
      }

      await tx`UPDATE estoque SET quantidade = quantidade - ${quantidade}, updated_at = NOW() WHERE produto_id = ${id}`

      await tx`
        INSERT INTO estoque_movimentos(tenant_id, produto_id, tipo, quantidade, qtd_antes, motivo, user_id)
        VALUES(${req.user.tenantId}, ${id}, 'saida', ${-quantidade}, ${qtdAntes}, ${motivo ?? 'Saída manual'}, ${req.user.id})
      `
    })

    return reply.send({ ok: true })
  })
}
