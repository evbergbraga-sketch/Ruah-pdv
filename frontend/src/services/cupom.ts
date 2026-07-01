import { impressora } from './impressora'

const COL = 42

/** Linha com texto à esquerda e valor à direita, total de COL colunas */
function cols(left: string, right: string, total = COL): string {
  const r = right.substring(0, total - 2)
  const l = left.substring(0, total - r.length - 1)
  return l.padEnd(total - r.length) + r
}

const FORMA: Record<string, string> = {
  dinheiro: 'DINHEIRO', pix: 'PIX', credito: 'CREDITO', debito: 'DEBITO',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function imprimirCupom(venda: any): Promise<void> {
  if (!impressora.conectada) await impressora.conectar()

  impressora.init()
    // Cabeçalho — nome da loja
    .align('center')
    .bold(true).double(true)
    .line((venda.loja_nome ?? 'LOJA').toUpperCase())
    .double(false).bold(false)

  if (venda.loja_cnpj)     impressora.line(`CNPJ: ${venda.loja_cnpj}`)
  if (venda.loja_endereco) impressora.line(venda.loja_endereco)
  if (venda.loja_telefone) impressora.line(`Tel: ${venda.loja_telefone}`)

  impressora.lf()
    .bold(true).line('CUPOM NAO FISCAL').bold(false)
    .line(`Venda #${String(venda.numero).padStart(4, '0')}`)
    .line(new Date(venda.created_at).toLocaleString('pt-BR'))

  if (venda.cliente?.nome) {
    impressora.line(`Cliente: ${venda.cliente.nome}`)
    if (venda.cliente.cpf) impressora.line(`CPF: ${venda.cliente.cpf}`)
  }

  // Itens
  impressora.align('left').sep()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of ((venda.itens ?? []) as any[]).filter(Boolean)) {
    impressora.line(item.nome.toUpperCase().substring(0, COL))
    const qtdPreco = `  ${item.quantidade}x R$ ${Number(item.preco_unitario).toFixed(2).replace('.', ',')}`
    const subtotal = `R$ ${Number(item.subtotal).toFixed(2).replace('.', ',')}`
    impressora.line(cols(qtdPreco, subtotal))
  }

  impressora.sep()

  if (Number(venda.desconto_valor) > 0) {
    impressora.line(cols('DESCONTO', `- R$ ${Number(venda.desconto_valor).toFixed(2).replace('.', ',')}`))
  }

  // Total em destaque
  impressora.bold(true).double(true)
    .line(cols('TOTAL', `R$ ${Number(venda.total).toFixed(2).replace('.', ',')}`))
    .double(false).bold(false)

  impressora.sep()

  // Pagamentos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of ((venda.pagamentos ?? []) as any[]).filter(Boolean)) {
    impressora.line(cols(FORMA[p.forma] ?? p.forma.toUpperCase(), `R$ ${Number(p.valor).toFixed(2).replace('.', ',')}`))
  }

  if (Number(venda.troco) > 0) {
    impressora.line(cols('TROCO', `R$ ${Number(venda.troco).toFixed(2).replace('.', ',')}`))
  }

  // Rodapé
  impressora.sep()
    .align('center')
    .lf()
    .line('Obrigado pela preferencia!')
    .lf(4)
    .cut()

  await impressora.print()
}
