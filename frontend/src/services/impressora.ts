/**
 * Serviço de impressão térmica — Bematech MP-4200 TH / Pos-80
 * VendorID: 0x0B1B · ESC/POS padrão
 * Acesso direto via WebUSB (Chrome/Edge) — sem driver
 */

const ESC = 0x1b
const GS  = 0x1d
const LF  = 0x0a

// Bematech VendorID + outros compatíveis como fallback
const VENDOR_IDS = [
  { vendorId: 0x0B1B }, // Bematech
  { vendorId: 0x0DD4 }, // Elgin
  { vendorId: 0x04B8 }, // Epson
  { vendorId: 0x0809 }, // Daruma
]

export class Impressora {
  private device: USBDevice | null = null
  private endpoint: number | null = null
  private buf: number[] = []

  get conectada() { return this.device !== null }

  async conectar(): Promise<void> {
    if (!navigator.usb) throw new Error('WebUSB não suportado. Use Chrome ou Edge.')

    this.device = await navigator.usb.requestDevice({ filters: VENDOR_IDS })
    await this.device.open()
    if (this.device.configuration === null) await this.device.selectConfiguration(1)
    await this.device.claimInterface(0)

    const ep = this.device.configuration!.interfaces[0].alternate.endpoints
      .find(e => e.direction === 'out')
    if (!ep) throw new Error('Endpoint USB não encontrado')
    this.endpoint = ep.endpointNumber
  }

  async desconectar() {
    if (this.device) { await this.device.close(); this.device = null; this.endpoint = null }
  }

  // ── Comandos ESC/POS ─────────────────────────────
  private c(...b: number[]) { this.buf.push(...b); return this }

  init()   { return this.c(ESC, 0x40) }
  lf(n=1)  { for(let i=0;i<n;i++) this.buf.push(LF); return this }
  text(s: string) { for(const ch of s) this.buf.push(ch.charCodeAt(0)); return this }
  line(s: string) { return this.text(s).lf() }
  align(a: 'left'|'center'|'right') { return this.c(ESC,0x61,{left:0,center:1,right:2}[a]) }
  bold(on: boolean)   { return this.c(ESC,0x45,on?1:0) }
  double(on: boolean) { return this.c(GS,0x21,on?0x11:0x00) }
  sep(ch='-',n=42)    { return this.line(ch.repeat(n)) }

  qrCode(url: string, size=6) {
    const d = new TextEncoder().encode(url)
    const l = d.length+3, ll=l&0xff, lh=(l>>8)&0xff
    this.c(GS,0x28,0x6b,4,0,0x31,0x41,0x32,0)      // modelo
    this.c(GS,0x28,0x6b,3,0,0x31,0x43,size)          // tamanho
    this.c(GS,0x28,0x6b,3,0,0x31,0x45,0x30)          // correção
    this.c(GS,0x28,0x6b,ll,lh,0x31,0x50,0x30,...d)   // dados
    this.c(GS,0x28,0x6b,3,0,0x31,0x51,0x30)          // imprimir
    return this
  }

  cut() { return this.c(GS,0x56,0) }

  async print(): Promise<void> {
    if (!this.device || this.endpoint === null) throw new Error('Impressora não conectada')
    await this.device.transferOut(this.endpoint, new Uint8Array(this.buf))
    this.buf = []
  }
}

// ── Formatar e imprimir cupom não fiscal ───────────────────────
export interface DadosCupom {
  loja: { nome: string; cnpj: string; endereco?: string; telefone?: string }
  numero: number
  data: Date
  operador: string
  cliente?: { nome?: string; cpf?: string }
  itens: { nome: string; quantidade: number; preco_unitario: number; subtotal: number }[]
  subtotal: number
  desconto: number
  total: number
  pagamentos: { forma: string; valor: number }[]
  troco: number
}

const R = (n: number) => `R$ ${n.toFixed(2).replace('.',',')}`
const PAD = (s: string, w: number, dir: 'l'|'r' = 'r') =>
  dir==='r' ? String(s).padEnd(w) : String(s).padStart(w)

export async function imprimirCupom(imp: Impressora, d: DadosCupom) {
  imp
    .init()
    .align('center').bold(true).double(true).line(d.loja.nome)
    .double(false).bold(false)
    .line(`CNPJ: ${d.loja.cnpj}`)

  if (d.loja.endereco) imp.line(d.loja.endereco)
  if (d.loja.telefone) imp.line(`Tel: ${d.loja.telefone}`)

  imp
    .lf()
    .line('*** NÃO É DOCUMENTO FISCAL ***')
    .align('left').sep()
    .line(`Cupom  : #${String(d.numero).padStart(6,'0')}`)
    .line(`Data   : ${d.data.toLocaleDateString('pt-BR')} ${d.data.toLocaleTimeString('pt-BR')}`)
    .line(`Operador: ${d.operador}`)

  if (d.cliente?.nome) imp.line(`Cliente: ${d.cliente.nome}`)
  if (d.cliente?.cpf)  imp.line(`CPF    : ${d.cliente.cpf}`)

  imp.sep()

  // Itens
  for (const it of d.itens) {
    const nome = it.nome.slice(0, 30).padEnd(30)
    const sub  = R(it.subtotal).padStart(12)
    imp.line(`${nome}${sub}`)
    if (it.quantidade !== 1) {
      imp.line(`  ${it.quantidade}x ${R(it.preco_unitario)}`)
    }
  }

  imp.sep()
  imp.line(`${'Subtotal'.padEnd(30)}${R(d.subtotal).padStart(12)}`)
  if (d.desconto > 0) imp.line(`${'Desconto'.padEnd(30)}${('-' + R(d.desconto)).padStart(12)}`)

  imp.bold(true).double(true)
  imp.line(`${'TOTAL'.padEnd(18)}${R(d.total).padStart(24)}`)
  imp.double(false).bold(false).sep()

  const formaLabel: Record<string, string> = {
    dinheiro:'DINHEIRO', credito:'CARTÃO CRÉDITO',
    debito:'CARTÃO DÉBITO', pix:'PIX', voucher:'VOUCHER',
  }
  for (const p of d.pagamentos) {
    imp.line(`${(formaLabel[p.forma] ?? p.forma).padEnd(30)}${R(p.valor).padStart(12)}`)
  }
  if (d.troco > 0) imp.bold(true).line(`${'TROCO'.padEnd(30)}${R(d.troco).padStart(12)}`).bold(false)

  imp.sep().align('center').line('Obrigada pela preferência! 💄').lf(3).cut()

  await imp.print()
}

// ── Imprimir DANFE via QR Code da Focus NFe ─────────────────────
export async function imprimirDANFE(
  imp: Impressora,
  dados: {
    numero: number
    chaveAcesso: string
    qrcodeUrl: string
    loja: { nome: string; cnpj: string }
    total: number
    protocolo: string
  }
) {
  imp
    .init()
    .align('center').bold(true).line('NFC-e — NOTA FISCAL DO CONSUMIDOR ELETRÔNICA')
    .bold(false).lf()
    .line(dados.loja.nome)
    .line(`CNPJ: ${dados.loja.cnpj}`)
    .lf()
    .line(`NF-e nº ${dados.numero}`)
    .line(`Protocolo: ${dados.protocolo}`)
    .lf()

  // QR Code para consulta do consumidor
  imp.qrCode(dados.qrcodeUrl)

  imp
    .lf()
    .line('Consulte pela chave de acesso:')
    .align('left')
    .line(dados.chaveAcesso.replace(/(.{4})/g,'$1 ').trim())
    .lf()
    .align('center').bold(true).double(true)
    .line(R(dados.total))
    .double(false).bold(false)
    .lf(3).cut()

  await imp.print()
}

// Singleton global
export const impressora = new Impressora()
