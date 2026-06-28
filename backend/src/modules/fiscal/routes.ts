import type { FastifyInstance } from 'fastify'
import { withTenant, db } from '../../db/client.js'
import { authenticate } from '../../middleware/auth.js'

function focusHeaders(token: string) {
  return {
    'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}`,
    'Content-Type': 'application/json',
  }
}

const FOCUS_BASE = 'https://api.focusnfe.com.br/v2'

function mapForma(forma: string): number {
  const m: Record<string, number> = { dinheiro:1, credito:3, debito:4, pix:17, voucher:5 }
  return m[forma] ?? 99
}

function montarPayloadNFCe(venda: Record<string, unknown>, tenant: Record<string, unknown>) {
  const itens = (venda.itens as Record<string, unknown>[]).map((vi, idx) => ({
    numero_item:             idx + 1,
    codigo_produto:          vi.produto_id,
    descricao:               vi.nome_produto ?? vi.nome,
    ncm:                     vi.ncm ?? '33049900',
    cfop:                    vi.cfop ?? '5102',
    unidade_comercial:       'UN',
    quantidade_comercial:    Number(vi.quantidade),
    valor_unitario_comercial: Number(vi.preco_unitario),
    valor_bruto:             Number(vi.subtotal),
    icms_situacao_tributaria: vi.cst ?? '400',
    icms_aliquota:           Number(vi.aliq_icms ?? 0),
    pis_situacao_tributaria:  '07',
    cofins_situacao_tributaria: '07',
  }))

  const pags = (venda.pagamentos as Record<string, unknown>[]).map(p => ({
    forma_pagamento: mapForma(String(p.forma)),
    valor:           Number(p.valor),
  }))

  const end = tenant.endereco as Record<string, string> | null
  const emitente = {
    cnpj:                    String(tenant.cnpj).replace(/\D/g, ''),
    nome:                    tenant.razao_social,
    nome_fantasia:           tenant.nome,
    logradouro:              end?.logradouro ?? '',
    numero:                  end?.numero ?? 'S/N',
    bairro:                  end?.bairro ?? '',
    municipio:               end?.cidade ?? '',
    uf:                      end?.uf ?? 'SP',
    cep:                     String(end?.cep ?? '').replace(/\D/g, ''),
    telefone:                String(tenant.telefone ?? '').replace(/\D/g, ''),
    regime_tributario:       '1', // Simples Nacional
  }

  const cliente = venda.cliente as Record<string, string> | null

  return {
    natureza_operacao:    'VENDA AO CONSUMIDOR',
    forma_pagamento:      0,
    finalidade_emissao:   1,
    consumidor_final:     1,
    presenca_comprador:   1,
    modalidade_frete:     9,
    emitente,
    items:                itens,
    formas_pagamento:     pags,
    ...(cliente?.cpf ? { cpf_destinatario: cliente.cpf.replace(/\D/g, '') } : {}),
    informacoes_adicionais_contribuinte: `Venda #${venda.numero}`,
  }
}

export async function fiscalRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  // Emite NFC-e para uma venda
  app.post('/nfce/:venda_id', async (req, reply) => {
    const { venda_id } = req.params as { venda_id: string }

    // Busca dados completos da venda + tenant
    const [venda] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT v.*,
        json_agg(DISTINCT jsonb_build_object(
          'produto_id', vi.produto_id, 'nome_produto', vi.nome_produto,
          'quantidade', vi.quantidade, 'preco_unitario', vi.preco_unitario,
          'subtotal', vi.subtotal, 'ncm', vi.ncm, 'cfop', vi.cfop, 'cst', vi.cst
        )) AS itens,
        json_agg(DISTINCT jsonb_build_object('forma', p.forma, 'valor', p.valor)) AS pagamentos,
        jsonb_build_object('nome', c.nome, 'cpf', c.cpf) AS cliente
      FROM vendas v
      LEFT JOIN venda_itens vi ON vi.venda_id = v.id
      LEFT JOIN pagamentos p   ON p.venda_id  = v.id
      LEFT JOIN clientes c     ON c.id = v.cliente_id
      WHERE v.id = ${venda_id} AND v.status = 'finalizada'
      GROUP BY v.id, c.nome, c.cpf
    `)
    if (!venda) return reply.status(404).send({ error: 'Venda não encontrada' })

    // Verifica se já emitiu
    const [jaEmitida] = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT id, status, danfe_url, qrcode_url FROM notas_fiscais
      WHERE venda_id = ${venda_id} AND status = 'autorizada' LIMIT 1
    `)
    if (jaEmitida) return reply.send({ nota: jaEmitida, jaEmitida: true })

    // Busca config do tenant (token + ambiente)
    const [tenant] = await db`
      SELECT nome, razao_social, cnpj, telefone, endereco,
             focus_token, focus_ambiente, nfce_serie, nfce_proximo_numero
      FROM tenants WHERE id = ${req.user.tenantId}
    `

    const token = tenant.focus_token ?? process.env.FOCUS_NFE_TOKEN
    if (!token) return reply.status(400).send({ error: 'Token Focus NFe não configurado' })

    const baseUrl = tenant.focus_ambiente === 'producao'
      ? FOCUS_BASE
      : 'https://homologacao.acrasnfe.acras.com.br/v2'

    // Referência única da nota
    const ref = `pdv_${req.user.tenantId.replace(/-/g,'').slice(0,8)}_${venda.numero}`

    const payload = montarPayloadNFCe(venda, tenant)

    const focusRes = await fetch(`${baseUrl}/nfce?ref=${ref}&completo=1`, {
      method: 'POST',
      headers: focusHeaders(token),
      body: JSON.stringify(payload),
    })

    const focusData = await focusRes.json() as Record<string, unknown>
    app.log.info({ ref, status: focusData.status }, 'Focus NFe response')

    if (!focusRes.ok && focusRes.status !== 422) {
      return reply.status(502).send({ error: 'Erro ao emitir NFC-e', detalhes: focusData })
    }

    // Salva a nota (status pendente — webhook ou poll irá atualizar)
    const [nota] = await withTenant(req.user.tenantId, async (tx) => tx`
      INSERT INTO notas_fiscais(tenant_id, venda_id, numero, serie, status, focus_ref)
      VALUES(${req.user.tenantId}, ${venda_id}, ${venda.numero}, ${tenant.nfce_serie}, 'pendente', ${ref})
      ON CONFLICT(focus_ref) DO UPDATE SET status = 'pendente'
      RETURNING *
    `)

    return reply.status(201).send({ nota, focus_ref: ref, focus_status: focusData.status })
  })

  // Consulta status de NFC-e na Focus NFe e atualiza banco
  app.get('/nfce/:ref/status', async (req, reply) => {
    const { ref } = req.params as { ref: string }

    const [tenant] = await db`
      SELECT focus_token, focus_ambiente FROM tenants WHERE id = ${req.user.tenantId}
    `
    const token = tenant.focus_token ?? process.env.FOCUS_NFE_TOKEN!
    const baseUrl = tenant.focus_ambiente === 'producao' ? FOCUS_BASE : 'https://homologacao.acrasnfe.acras.com.br/v2'

    const res = await fetch(`${baseUrl}/nfce/${ref}?completo=1`, { headers: focusHeaders(token) })
    if (!res.ok) return reply.status(404).send({ error: 'NFC-e não encontrada' })

    const data = await res.json() as Record<string, unknown>

    if (data.status === 'autorizado') {
      await withTenant(req.user.tenantId, async (tx) => tx`
        UPDATE notas_fiscais SET
          status       = 'autorizada',
          chave_acesso = ${data.chave_nfe as string},
          protocolo    = ${data.protocolo as string},
          qrcode_url   = ${data.qrcode_url as string},
          danfe_url    = ${data.danfe_url as string},
          emitida_em   = NOW()
        WHERE focus_ref = ${ref}
      `)
    } else if (data.status === 'erro') {
      await withTenant(req.user.tenantId, async (tx) => tx`
        UPDATE notas_fiscais SET status = 'rejeitada',
          motivo_rejeicao = ${JSON.stringify(data.erros)}
        WHERE focus_ref = ${ref}
      `)
    }

    return reply.send(data)
  })

  // Cancela NFC-e
  app.delete('/nfce/:ref', async (req, reply) => {
    const { ref } = req.params as { ref: string }
    const { justificativa } = (req.body ?? {}) as { justificativa?: string }
    if (!justificativa || justificativa.length < 15) {
      return reply.status(400).send({ error: 'Justificativa mínima de 15 caracteres' })
    }

    const [tenant] = await db`SELECT focus_token, focus_ambiente FROM tenants WHERE id = ${req.user.tenantId}`
    const token = tenant.focus_token ?? process.env.FOCUS_NFE_TOKEN!
    const baseUrl = tenant.focus_ambiente === 'producao' ? FOCUS_BASE : 'https://homologacao.acrasnfe.acras.com.br/v2'

    const res = await fetch(`${baseUrl}/nfce/${ref}`, {
      method: 'DELETE',
      headers: focusHeaders(token),
      body: JSON.stringify({ justificativa }),
    })

    const data = await res.json() as Record<string, unknown>
    if (res.ok) {
      await withTenant(req.user.tenantId, async (tx) => tx`
        UPDATE notas_fiscais SET status = 'cancelada', cancelada_em = NOW()
        WHERE focus_ref = ${ref}
      `)
    }

    return reply.send(data)
  })

  // Lista NFC-e de uma venda
  app.get('/venda/:venda_id', async (req, reply) => {
    const { venda_id } = req.params as { venda_id: string }
    const notas = await withTenant(req.user.tenantId, async (tx) => tx`
      SELECT * FROM notas_fiscais WHERE venda_id = ${venda_id} ORDER BY created_at DESC
    `)
    return reply.send({ notas })
  })
}
