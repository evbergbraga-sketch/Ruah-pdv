import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { withTenant } from '../../db/client.js'
import { authenticate } from '../../middleware/auth.js'

const criarVendaSchema = z.object({
  caixa_id:      z.string().uuid({ message: 'Caixa precisa estar aberto para vender' }),
  cliente_id:    z.string().uuid().optional(),
  itens: z.array(z.object({
    produto_id:     z.string().uuid(),
    quantidade:     z.number().positive(),
    preco_unitario: z.number().positive(),
    desconto_valor: z.number().min(0).default(0),
  })).min(1),
  pagamentos: z.array(z.object({
    forma:   z.enum(['dinheiro','credito','debito','pix','voucher']),
    valor:   z.number().positive(),
    bandeira: z.string().optional(),
  })).min(1),
  desconto_valor: z.number().min(0).default(0),
  observacoes:    z.string().optional(),
})

export async function pdvRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // Busca produto por EAN (leitor de barcode) ou texto
  app.get('/produtos', async (req, reply) => {
    const { q, ean, limit = '30' } = req.query as Record<string, string>

    const produtos = await withTenant(req.user.tenantId, async (tx) => {
      // Busca por EAN exato (leitor de barcode)
      if (ean) {
        return tx`
          SELECT p.id, p.nome, p.ean, p.codigo, p.preco_venda, p.unidade,
                 e.quantidade AS estoque, c.nome AS categoria, c.cor AS cat_cor
          FROM produtos p
          LEFT JOIN estoque e ON e.produto_id = p.id
          LEFT JOIN categorias c ON c.id = p.categoria_id
          WHERE p.ativo = true AND p.ean = ${ean}
          LIMIT 1
        `
      }
      // Busca textual (nome, código, EAN parcial)
      if (q?.trim()) {
        return tx`
          SELECT p.id, p.nome, p.ean, p.codigo, p.preco_venda, p.unidade,
                 e.quantidade AS estoque, c.nome AS categoria, c.cor AS cat_cor
          FROM produtos p
          LEFT JOIN estoque e ON e.produto_id = p.id
          LEFT JOIN categorias c ON c.id = p.categoria_id
          WHERE p.ativo = true AND (
            p.nome ILIKE ${'%' + q + '%'} OR
            p.ean  ILIKE ${'%' + q + '%'} OR
            p.codigo ILIKE ${'%' + q + '%'}
          )
          ORDER BY p.nome
          LIMIT ${Number(limit)}
        `
      }
      // Lista todos (grade inicial do PDV)
      return tx`
        SELECT p.id, p.nome, p.ean, p.codigo, p.preco_venda, p.unidade,
               e.quantidade AS estoque, c.nome AS categoria, c.cor AS cat_cor
        FROM produtos p
        LEFT JOIN estoque e ON e.produto_id = p.id
        LEFT JOIN categorias c ON c.id = p.categoria_id
        WHERE p.ativo = true
        ORDER BY p.nome
        LIMIT ${Number(limit)}
      `
    })

    return reply.send({ produtos })
  })

  // Finaliza venda — salva itens, pagamentos e dispara trigger de estoque
  app.post('/venda', async (req, reply) => {
    const parsed = criarVendaSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.format() })

    const { caixa_id, cliente_id, itens, pagamentos, desconto_valor, observacoes } = parsed.data

    const subtotal = itens.reduce(
      (acc, i) => acc + i.preco_unitario * i.quantidade - i.desconto_valor, 0
    )
    const total = subtotal - desconto_valor
    const totalPago = pagamentos.reduce((acc, p) => acc + p.valor, 0)

    if (totalPago < total - 0.01) {
      return reply.status(400).send({ error: 'Valor pago insuficiente', faltam: total - totalPago })
    }

    const troco = Math.max(0, totalPago - total)

    try {
      const venda = await withTenant(req.user.tenantId, async (tx) => {
        // Garante que o caixa existe, pertence ao tenant e está aberto —
        // nunca confiar só na validação do frontend
        const [caixa] = await tx`SELECT id, status FROM caixas WHERE id = ${caixa_id}`
        if (!caixa) throw new Error('Caixa não encontrado')
        if (caixa.status !== 'aberto') throw new Error('Caixa está fechado — abra o caixa antes de vender')

        const [{ numero }] = await tx`SELECT next_venda_number(${req.user.tenantId}) AS numero`

        const [v] = await tx`
          INSERT INTO vendas(tenant_id, caixa_id, cliente_id, user_id, numero,
            status, subtotal, desconto_valor, total, troco, observacoes)
          VALUES(${req.user.tenantId}, ${caixa_id}, ${cliente_id ?? null},
            ${req.user.id}, ${numero}, 'finalizada',
            ${subtotal}, ${desconto_valor}, ${total}, ${troco}, ${observacoes ?? null})
          RETURNING *
        `

        for (const item of itens) {
          const [prod] = await tx`SELECT nome, ncm, cfop, cst FROM produtos WHERE id = ${item.produto_id}`
          await tx`
            INSERT INTO venda_itens(tenant_id, venda_id, produto_id, nome_produto,
              quantidade, preco_unitario, desconto_valor, subtotal, ncm, cfop, cst)
            VALUES(${req.user.tenantId}, ${v.id}, ${item.produto_id}, ${prod.nome},
              ${item.quantidade}, ${item.preco_unitario}, ${item.desconto_valor},
              ${item.preco_unitario * item.quantidade - item.desconto_valor},
              ${prod.ncm}, ${prod.cfop}, ${prod.cst})
          `

          // Baixa de estoque explícita — não depender de trigger no banco,
          // que já se mostrou frágil (perdido em recriações manuais do schema)
          const [estoqueAtual] = await tx`SELECT quantidade FROM estoque WHERE produto_id = ${item.produto_id}`
          const qtdAntes = estoqueAtual?.quantidade ?? 0

          await tx`
            UPDATE estoque SET quantidade = quantidade - ${item.quantidade}, updated_at = NOW()
            WHERE produto_id = ${item.produto_id}
          `

          await tx`
            INSERT INTO estoque_movimentos(tenant_id, produto_id, tipo, quantidade, qtd_antes, venda_id, motivo)
            VALUES(${req.user.tenantId}, ${item.produto_id}, 'venda', ${-item.quantidade}, ${qtdAntes}, ${v.id}, ${'Venda #' + numero})
          `
        }

        for (const p of pagamentos) {
          await tx`
            INSERT INTO pagamentos(tenant_id, venda_id, forma, valor, bandeira)
            VALUES(${req.user.tenantId}, ${v.id}, ${p.forma}, ${p.valor}, ${p.bandeira ?? null})
          `
        }

        return v
      })

      return reply.status(201).send({ venda })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao processar venda'
      return reply.status(400).send({ error: msg })
    }
  })

  // Busca venda completa para impressão / reimpressão
  app.get('/venda/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const [venda] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT
        v.*,
        json_agg(DISTINCT jsonb_build_object(
          'nome', vi.nome_produto, 'quantidade', vi.quantidade,
          'preco_unitario', vi.preco_unitario, 'subtotal', vi.subtotal
        )) AS itens,
        json_agg(DISTINCT jsonb_build_object('forma', p.forma, 'valor', p.valor)) AS pagamentos,
        jsonb_build_object('nome', c.nome, 'cpf', c.cpf) AS cliente,
        t.nome AS loja_nome, t.cnpj AS loja_cnpj,
        t.endereco AS loja_endereco, t.telefone AS loja_telefone
      FROM vendas v
      LEFT JOIN venda_itens vi ON vi.venda_id = v.id
      LEFT JOIN pagamentos p   ON p.venda_id  = v.id
      LEFT JOIN clientes c     ON c.id = v.cliente_id
      JOIN tenants t           ON t.id = v.tenant_id
      WHERE v.id = ${id}
      GROUP BY v.id, c.nome, c.cpf, t.nome, t.cnpj, t.endereco, t.telefone
    `)

    if (!venda) return reply.status(404).send({ error: 'Venda não encontrada' })
    return reply.send({ venda })
  })

  // Cancela venda (apenas gerente/admin)
  app.patch('/venda/:id/cancelar', async (req, reply) => {
    if (req.user.role === 'operador') return reply.status(403).send({ error: 'Sem permissão' })
    const { id } = req.params as { id: string }
    const { motivo } = (req.body ?? {}) as { motivo?: string }

    const [v] = await withTenant(req.user.tenantId, async (tx) => tx`
      UPDATE vendas SET status = 'cancelada', cancelamento_motivo = ${motivo ?? null},
        cancelada_em = NOW()
      WHERE id = ${id} AND status = 'finalizada'
      RETURNING *
    `)
    if (!v) return reply.status(400).send({ error: 'Venda não encontrada ou já cancelada' })
    return reply.send({ venda: v })
  })
}
