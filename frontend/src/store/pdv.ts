import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export interface Produto {
  id: string
  nome: string
  ean?: string
  codigo?: string
  preco_venda: number
  unidade: string
  estoque: number
  categoria?: string
  cat_cor?: string
}

export interface ItemCarrinho {
  produto: Produto
  quantidade: number
  preco_unitario: number
  desconto_valor: number
}

export interface Caixa {
  id: string
  valor_abertura: number
  aberto_em: string
  operador: string
}

export interface Cliente {
  id: string
  nome: string
  cpf?: string
  telefone?: string
}

interface PDVState {
  caixa: Caixa | null
  itens: ItemCarrinho[]
  cliente: Cliente | null
  descontoVenda: number

  // computed
  subtotal: number
  total: number

  // actions
  setCaixa: (c: Caixa | null) => void
  addProduto: (p: Produto, qtd?: number) => void
  remover: (id: string) => void
  setQtd: (id: string, qtd: number) => void
  setDescItem: (id: string, desc: number) => void
  setCliente: (c: Cliente | null) => void
  setDescVenda: (v: number) => void
  limpar: () => void
}

const calc = (itens: ItemCarrinho[]) =>
  itens.reduce((s, i) => s + i.preco_unitario * i.quantidade - i.desconto_valor, 0)

export const usePDV = create<PDVState>()(
  immer((set) => ({
    caixa: null, itens: [], cliente: null, descontoVenda: 0,
    subtotal: 0, total: 0,

    setCaixa: (caixa) => set(s => { s.caixa = caixa }),

    addProduto: (p, qtd = 1) => set(s => {
      const ex = s.itens.find(i => i.produto.id === p.id)
      if (ex) ex.quantidade += qtd
      else s.itens.push({ produto: p, quantidade: qtd, preco_unitario: p.preco_venda, desconto_valor: 0 })
      s.subtotal = calc(s.itens)
      s.total = s.subtotal - s.descontoVenda
    }),

    remover: (id) => set(s => {
      s.itens = s.itens.filter(i => i.produto.id !== id)
      s.subtotal = calc(s.itens)
      s.total = s.subtotal - s.descontoVenda
    }),

    setQtd: (id, qtd) => set(s => {
      if (qtd <= 0) { s.itens = s.itens.filter(i => i.produto.id !== id) }
      else { const i = s.itens.find(i => i.produto.id === id); if (i) i.quantidade = qtd }
      s.subtotal = calc(s.itens)
      s.total = s.subtotal - s.descontoVenda
    }),

    setDescItem: (id, desc) => set(s => {
      const item = s.itens.find(i => i.produto.id === id)
      if (item) item.desconto_valor = Math.min(desc, item.preco_unitario * item.quantidade)
      s.subtotal = calc(s.itens)
      s.total = s.subtotal - s.descontoVenda
    }),

    setCliente: (c) => set(s => { s.cliente = c }),

    setDescVenda: (v) => set(s => {
      s.descontoVenda = Math.min(v, s.subtotal)
      s.total = s.subtotal - s.descontoVenda
    }),

    limpar: () => set(s => {
      s.itens = []; s.cliente = null; s.descontoVenda = 0; s.subtotal = 0; s.total = 0
    }),
  }))
)
