import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { withTenant } from '../../db/client.js'
import { authenticate } from '../../middleware/auth.js'

export async function caixaRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // Caixa aberto atual
  app.get('/status', async (req, reply) => {
    const [caixa] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT c.*, u.nome AS operador
      FROM caixas c LEFT JOIN users u ON u.id = c.user_abertura_id
      WHERE c.status = 'aberto' ORDER BY c.aberto_em DESC LIMIT 1
    `)
    return reply.send({ caixa: caixa ?? null, aberto: !!caixa })
  })

  // Abrir caixa
  app.post('/abrir', async (req, reply) => {
    const { valor_abertura = 0 } = (req.body ?? {}) as { valor_abertura?: number }

    const [existente] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT id FROM caixas WHERE status = 'aberto' LIMIT 1
    `)
    if (existente) return reply.status(409).send({ error: 'Já existe um caixa aberto' })

    const [caixa] = await withTenant(req.user.tenantId, async (tx) => tx`
      INSERT INTO caixas(tenant_id, user_abertura_id, valor_abertura)
      VALUES(${req.user.tenantId}, ${req.user.id}, ${valor_abertura})
      RETURNING *
    `)
    return reply.status(201).send({ caixa })
  })

  // Fechar caixa — calcula valor esperado automaticamente
  app.post('/:id/fechar', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = z.object({
      valor_fechamento: z.number().min(0),
      observacoes: z.string().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Valor inválido' })

    const caixa = await withTenant(req.user.tenantId, async (tx) => {
      const [c] = await tx`SELECT * FROM caixas WHERE id = ${id} AND status = 'aberto' LIMIT 1`
      if (!c) return null

      // Soma vendas em dinheiro + movimentos
      const [totais] = await tx`
        SELECT
          COALESCE(SUM(pg.valor) FILTER (WHERE pg.forma = 'dinheiro'), 0) AS vendas_dinheiro,
          COALESCE(SUM(cm.valor) FILTER (WHERE cm.tipo = 'suprimento'), 0) -
          COALESCE(SUM(cm.valor) FILTER (WHERE cm.tipo = 'sangria'), 0)   AS movimentos
        FROM vendas v
        LEFT JOIN pagamentos    pg ON pg.venda_id  = v.id
        LEFT JOIN caixa_movimentos cm ON cm.caixa_id = ${id}
        WHERE v.caixa_id = ${id} AND v.status = 'finalizada'
      `

      const esperado = Number(c.valor_abertura) + Number(totais.vendas_dinheiro) + Number(totais.movimentos)
      const diferenca = body.data.valor_fechamento - esperado

      const [fechado] = await tx`
        UPDATE caixas SET
          status = 'fechado', user_fechamento_id = ${req.user.id},
          valor_fechamento = ${body.data.valor_fechamento},
          valor_esperado   = ${esperado},
          diferenca        = ${diferenca},
          observacoes      = ${body.data.observacoes ?? null},
          fechado_em       = NOW()
        WHERE id = ${id} RETURNING *
      `
      return fechado
    })

    if (!caixa) return reply.status(404).send({ error: 'Caixa não encontrado ou já fechado' })
    return reply.send({ caixa })
  })

  // Sangria
  app.post('/:id/sangria', async (req, reply) => {
    if (req.user.role === 'operador') return reply.status(403).send({ error: 'Sem permissão' })
    const body = z.object({ valor: z.number().positive(), descricao: z.string().optional() }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Valor inválido' })
    const { id } = req.params as { id: string }

    const [mov] = await withTenant(req.user.tenantId, async (tx) => tx`
      INSERT INTO caixa_movimentos(tenant_id, caixa_id, tipo, valor, descricao, user_id)
      VALUES(${req.user.tenantId}, ${id}, 'sangria', ${body.data.valor},
             ${body.data.descricao ?? null}, ${req.user.id})
      RETURNING *
    `)
    return reply.status(201).send({ movimento: mov })
  })


  // Resumo do caixa: totais por forma de pagamento e nº de vendas
  app.get('/:id/resumo', async (req, reply) => {
    const { id } = req.params as { id: string }

    const [totais] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT
        COUNT(DISTINCT v.id)::int                                           AS qtd_vendas,
        COALESCE(SUM(v.total), 0)                                          AS total_bruto,
        json_agg(DISTINCT jsonb_build_object(
          'forma', pg.forma,
          'valor', COALESCE(SUM(pg.valor) OVER (PARTITION BY pg.forma), 0),
          'qtd',   COUNT(pg.id)           OVER (PARTITION BY pg.forma)
        )) FILTER (WHERE pg.forma IS NOT NULL)                             AS por_forma
      FROM vendas v
      LEFT JOIN pagamentos pg ON pg.venda_id = v.id
      WHERE v.caixa_id = ${id} AND v.status = 'finalizada'
      GROUP BY v.total, pg.forma, pg.valor, pg.id
    `)

    // Agrega por forma separadamente para evitar duplicatas do window
    const porForma = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT pg.forma, COUNT(DISTINCT v.id)::int AS qtd, COALESCE(SUM(pg.valor), 0) AS valor
      FROM vendas v
      JOIN pagamentos pg ON pg.venda_id = v.id
      WHERE v.caixa_id = ${id} AND v.status = 'finalizada'
      GROUP BY pg.forma
    `)

    const [caixa] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT valor_abertura FROM caixas WHERE id = ${id}
    `)

    const totalBruto = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT COUNT(*)::int AS qtd, COALESCE(SUM(total), 0) AS total
      FROM vendas WHERE caixa_id = ${id} AND status = 'finalizada'
    `)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dinheiro = (porForma as any[]).find((f: { forma: string }) => f.forma === 'dinheiro')
    const valorEsperado = Number(caixa?.valor_abertura ?? 0) + Number(dinheiro?.valor ?? 0)

    return reply.send({
      qtd_vendas:    Number(totalBruto[0]?.qtd ?? 0),
      total_bruto:   Number(totalBruto[0]?.total ?? 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      por_forma:     (porForma as any[]).map((f: { forma: string; qtd: number; valor: number }) => ({
        forma: f.forma, qtd: Number(f.qtd), valor: Number(f.valor)
      })),
      valor_esperado: valorEsperado,
    })
  })

  // Suprimento
  app.post('/:id/suprimento', async (req, reply) => {
    const body = z.object({ valor: z.number().positive(), descricao: z.string().optional() }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Valor inválido' })
    const { id } = req.params as { id: string }

    const [mov] = await withTenant(req.user.tenantId, async (tx) => tx`
      INSERT INTO caixa_movimentos(tenant_id, caixa_id, tipo, valor, descricao, user_id)
      VALUES(${req.user.tenantId}, ${id}, 'suprimento', ${body.data.valor},
             ${body.data.descricao ?? null}, ${req.user.id})
      RETURNING *
    `)
    return reply.status(201).send({ movimento: mov })
  })

  // Movimentos do caixa
  app.get('/:id/movimentos', async (req, reply) => {
    const { id } = req.params as { id: string }
    const movimentos = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT cm.*, u.nome AS operador
      FROM caixa_movimentos cm LEFT JOIN users u ON u.id = cm.user_id
      WHERE cm.caixa_id = ${id} ORDER BY cm.created_at DESC
    `)
    return reply.send({ movimentos })
  })
}
