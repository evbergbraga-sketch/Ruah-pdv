import type { FastifyInstance } from 'fastify'
import { withTenant } from '../../db/client.js'
import { authenticate } from '../../middleware/auth.js'

type Periodo = 'hoje' | 'semana' | 'mes'
const PERIODOS = ['hoje', 'semana', 'mes']

export async function relatoriosRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // Resumo de vendas por período (hoje / semana / mes)
  app.get('/vendas', async (req, reply) => {
    const { periodo = 'hoje' } = req.query as { periodo?: string }
    const p: Periodo = PERIODOS.includes(periodo) ? periodo as Periodo : 'hoje'

    const [totais] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT
        COUNT(*)::int             AS qtd_vendas,
        COALESCE(SUM(total), 0)   AS total_bruto,
        COALESCE(AVG(total), 0)   AS ticket_medio
      FROM vendas v
      WHERE v.status = 'finalizada'
        AND (
          (${p} = 'hoje'   AND DATE(v.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE)
          OR (${p} = 'semana' AND v.created_at >= DATE_TRUNC('week',  NOW()))
          OR (${p} = 'mes'    AND v.created_at >= DATE_TRUNC('month', NOW()))
        )
    `)

    const porForma = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT pg.forma, COUNT(DISTINCT v.id)::int AS qtd, COALESCE(SUM(pg.valor), 0) AS valor
      FROM vendas v
      JOIN pagamentos pg ON pg.venda_id = v.id
      WHERE v.status = 'finalizada'
        AND (
          (${p} = 'hoje'   AND DATE(v.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE)
          OR (${p} = 'semana' AND v.created_at >= DATE_TRUNC('week',  NOW()))
          OR (${p} = 'mes'    AND v.created_at >= DATE_TRUNC('month', NOW()))
        )
      GROUP BY pg.forma
      ORDER BY valor DESC
    `)

    const topProdutos = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT vi.nome_produto AS nome,
             SUM(vi.quantidade)::int       AS qtd_vendida,
             COALESCE(SUM(vi.subtotal), 0) AS total
      FROM vendas v
      JOIN venda_itens vi ON vi.venda_id = v.id
      WHERE v.status = 'finalizada'
        AND (
          (${p} = 'hoje'   AND DATE(v.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE)
          OR (${p} = 'semana' AND v.created_at >= DATE_TRUNC('week',  NOW()))
          OR (${p} = 'mes'    AND v.created_at >= DATE_TRUNC('month', NOW()))
        )
      GROUP BY vi.nome_produto
      ORDER BY qtd_vendida DESC
      LIMIT 5
    `)

    const vendas = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT v.numero, v.total, v.created_at,
             STRING_AGG(DISTINCT pg.forma, ', ') AS formas
      FROM vendas v
      LEFT JOIN pagamentos pg ON pg.venda_id = v.id
      WHERE v.status = 'finalizada'
        AND (
          (${p} = 'hoje'   AND DATE(v.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE)
          OR (${p} = 'semana' AND v.created_at >= DATE_TRUNC('week',  NOW()))
          OR (${p} = 'mes'    AND v.created_at >= DATE_TRUNC('month', NOW()))
        )
      GROUP BY v.id, v.numero, v.total, v.created_at
      ORDER BY v.created_at DESC
      LIMIT 50
    `)

    return reply.send({
      periodo: p,
      qtd_vendas:   Number(totais?.qtd_vendas  ?? 0),
      total_bruto:  Number(totais?.total_bruto  ?? 0),
      ticket_medio: Number(totais?.ticket_medio ?? 0),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      por_forma: (porForma as any[]).map((f: { forma: string; qtd: number; valor: number }) => ({
        forma: f.forma, qtd: Number(f.qtd), valor: Number(f.valor),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      top_produtos: (topProdutos as any[]).map((p: { nome: string; qtd_vendida: number; total: number }) => ({
        nome: p.nome, qtd_vendida: Number(p.qtd_vendida), total: Number(p.total),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vendas: (vendas as any[]).map((v: { numero: number; total: number; created_at: string; formas: string }) => ({
        numero: v.numero, total: Number(v.total), created_at: v.created_at, formas: v.formas,
      })),
    })
  })
}
