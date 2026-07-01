import type { FastifyInstance } from 'fastify'
import { withTenant } from '../../db/client.js'
import { authenticate } from '../../middleware/auth.js'

type Periodo = 'hoje' | 'semana' | 'mes'
const PERIODOS = ['hoje', 'semana', 'mes']

/** Início do período em UTC, respeitando fuso de Brasília (UTC-3) */
function inicioPeriodo(p: Periodo): Date {
  // Formata a data atual no fuso de São Paulo (sv-locale = YYYY-MM-DD)
  const hojeLocal = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' })
  if (p === 'hoje') {
    return new Date(hojeLocal + 'T00:00:00-03:00')
  }
  if (p === 'semana') {
    const d = new Date(hojeLocal + 'T00:00:00-03:00')
    d.setDate(d.getDate() - d.getDay()) // voltar ao domingo
    return d
  }
  // mes
  const [ano, mes] = hojeLocal.split('-')
  return new Date(`${ano}-${mes}-01T00:00:00-03:00`)
}

export async function relatoriosRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/vendas', async (req, reply) => {
    const { periodo = 'hoje' } = req.query as { periodo?: string }
    const p: Periodo = PERIODOS.includes(periodo) ? periodo as Periodo : 'hoje'
    const inicio = inicioPeriodo(p)

    const [totais] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT
        COUNT(*)::int           AS qtd_vendas,
        COALESCE(SUM(total), 0) AS total_bruto,
        COALESCE(AVG(total), 0) AS ticket_medio
      FROM vendas v
      WHERE v.status = 'finalizada' AND v.created_at >= ${inicio}
    `)

    const porForma = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT pg.forma, COUNT(DISTINCT v.id)::int AS qtd, COALESCE(SUM(pg.valor), 0) AS valor
      FROM vendas v
      JOIN pagamentos pg ON pg.venda_id = v.id
      WHERE v.status = 'finalizada' AND v.created_at >= ${inicio}
      GROUP BY pg.forma
      ORDER BY valor DESC
    `)

    const topProdutos = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT vi.nome_produto AS nome,
             SUM(vi.quantidade)::int       AS qtd_vendida,
             COALESCE(SUM(vi.subtotal), 0) AS total
      FROM vendas v
      JOIN venda_itens vi ON vi.venda_id = v.id
      WHERE v.status = 'finalizada' AND v.created_at >= ${inicio}
      GROUP BY vi.nome_produto
      ORDER BY qtd_vendida DESC
      LIMIT 5
    `)

    const vendas = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT v.id, v.numero, v.total, v.created_at,
             STRING_AGG(DISTINCT pg.forma, ', ') AS formas
      FROM vendas v
      LEFT JOIN pagamentos pg ON pg.venda_id = v.id
      WHERE v.status = 'finalizada' AND v.created_at >= ${inicio}
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
      por_forma: (porForma as any[]).map((f) => ({
        forma: f.forma as string, qtd: Number(f.qtd), valor: Number(f.valor),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      top_produtos: (topProdutos as any[]).map((p) => ({
        nome: p.nome as string, qtd_vendida: Number(p.qtd_vendida), total: Number(p.total),
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vendas: (vendas as any[]).map((v) => ({
        id: v.id as string, numero: v.numero as number,
        total: Number(v.total), created_at: v.created_at as string, formas: v.formas as string,
      })),
    })
  })
}
