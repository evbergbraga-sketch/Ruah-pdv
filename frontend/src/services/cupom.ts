/**
 * Impressão de cupom via driver Windows (iframe + window.print)
 * Funciona com qualquer impressora instalada no sistema operacional.
 * A abordagem WebUSB foi descartada pois o Windows bloqueia o acesso
 * raw ao dispositivo quando um driver está instalado.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gerarHtmlCupom(venda: any): string {
  const R = (n: number | string) =>
    `R$ ${Number(n).toFixed(2).replace('.', ',')}`

  const FORMA: Record<string, string> = {
    dinheiro: 'DINHEIRO', pix: 'PIX', credito: 'CRÉDITO', debito: 'DÉBITO',
  }

  const dataHora = new Date(venda.created_at).toLocaleString('pt-BR')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itensHtml = ((venda.itens ?? []) as any[])
    .filter(Boolean)
    .map((item: any) => `
      <div class="item">
        <div class="item-nome">${String(item.nome).toUpperCase()}</div>
        <div class="item-row">
          <span>${item.quantidade}x ${R(item.preco_unitario)}</span>
          <span>${R(item.subtotal)}</span>
        </div>
      </div>`)
    .join('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pagamentosHtml = ((venda.pagamentos ?? []) as any[])
    .filter(Boolean)
    .map((p: any) => {
      const label = FORMA[p.forma] ?? p.forma.toUpperCase()
      const parc = p.parcelas > 1 ? ` ${p.parcelas}x` : ''
      return `<div class="row"><span>${label}${parc}</span><span>${R(p.valor)}</span></div>`
    })
    .join('')

  const trocoHtml = Number(venda.troco) > 0
    ? `<div class="row troco"><span>TROCO</span><span>${R(venda.troco)}</span></div>`
    : ''

  const descontoHtml = Number(venda.desconto_valor) > 0
    ? `<div class="row"><span>DESCONTO</span><span>- ${R(venda.desconto_valor)}</span></div>`
    : ''

  const enderecoHtml = [venda.loja_cnpj && `CNPJ: ${venda.loja_cnpj}`,
    venda.loja_endereco, venda.loja_telefone && `Tel: ${venda.loja_telefone}`]
    .filter(Boolean).map(l => `<div>${l}</div>`).join('')

  const clienteHtml = venda.cliente?.nome
    ? `<div class="sep"></div><div>Cliente: ${venda.cliente.nome}</div>${venda.cliente.cpf ? `<div>CPF: ${venda.cliente.cpf}</div>` : ''}`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 0; size: 80mm auto; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    width: 72mm;
    padding: 3mm 2mm;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .grande { font-size: 15px; font-weight: bold; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; padding: 1px 0; }
  .item { margin: 3px 0; }
  .item-nome { font-weight: bold; }
  .item-row { display: flex; justify-content: space-between; color: #333; }
  .total { font-size: 14px; font-weight: bold; }
  .troco { color: #000; }
  .rodape { margin-top: 6px; }
</style>
</head>
<body>
  <div class="center bold grande">${(venda.loja_nome ?? 'LOJA').toUpperCase()}</div>
  <div class="center">${enderecoHtml}</div>
  <div class="sep"></div>
  <div class="center bold">CUPOM NÃO FISCAL</div>
  <div class="center">Venda #${String(venda.numero).padStart(4, '0')}</div>
  <div class="center">${dataHora}</div>
  ${clienteHtml}
  <div class="sep"></div>
  ${itensHtml}
  <div class="sep"></div>
  ${descontoHtml}
  <div class="row total"><span>TOTAL</span><span>${R(venda.total)}</span></div>
  <div class="sep"></div>
  ${pagamentosHtml}
  ${trocoHtml}
  <div class="sep"></div>
  <div class="center rodape">Obrigado pela preferência!</div>
</body>
</html>`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function imprimirCupom(venda: any): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const html = gerarHtmlCupom(venda)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.top = '-99999px'
      iframe.style.left = '-99999px'
      iframe.src = url

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          setTimeout(() => {
            document.body.removeChild(iframe)
            URL.revokeObjectURL(url)
            resolve()
          }, 500)
        } catch (e) {
          reject(e)
        }
      }

      document.body.appendChild(iframe)
    } catch (e) {
      reject(e)
    }
  })
}
