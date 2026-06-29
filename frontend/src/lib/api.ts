const BASE = import.meta.env.VITE_API_URL ?? 'https://ruah-pdv-production.up.railway.app'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error ?? 'Erro desconhecido')
  }
  return res.json()
}

export const api = {
  pdv: {
    buscarProdutos: (q?: string, ean?: string) =>
      req(`/api/pdv/produtos?${new URLSearchParams({ ...(q ? { q } : {}), ...(ean ? { ean } : {}) })}`),
    criarVenda: (body: unknown) =>
      req('/api/pdv/venda', { method: 'POST', body: JSON.stringify(body) }),
    buscarVenda: (id: string) =>
      req(`/api/pdv/venda/${id}`),
  },
  estoque: {
    listar: (q?: string) =>
      req(`/api/estoque/produtos${q ? `?q=${q}` : ''}`),
    criarProduto: (body: unknown) =>
      req('/api/estoque/produtos', { method: 'POST', body: JSON.stringify(body) }),
    entrada: (id: string, quantidade: number, motivo?: string) =>
      req(`/api/estoque/produtos/${id}/entrada`, { method: 'POST', body: JSON.stringify({ quantidade, motivo }) }),
  },
  caixa: {
    status: () => req('/api/caixa/status'),
    abrir: (valor_abertura: number) =>
      req('/api/caixa/abrir', { method: 'POST', body: JSON.stringify({ valor_abertura }) }),
    fechar: (id: string, valor_fechamento: number, obs?: string) =>
      req(`/api/caixa/${id}/fechar`, { method: 'POST', body: JSON.stringify({ valor_fechamento, observacoes: obs }) }),
    sangria: (id: string, valor: number, desc?: string) =>
      req(`/api/caixa/${id}/sangria`, { method: 'POST', body: JSON.stringify({ valor, descricao: desc }) }),
    suprimento: (id: string, valor: number, desc?: string) =>
      req(`/api/caixa/${id}/suprimento`, { method: 'POST', body: JSON.stringify({ valor, descricao: desc }) }),
    movimentos: (id: string) => req(`/api/caixa/${id}/movimentos`),
  },
  fiscal: {
    emitirNFCe: (venda_id: string) =>
      req(`/api/fiscal/nfce/${venda_id}`, { method: 'POST' }),
    statusNFCe: (ref: string) =>
      req(`/api/fiscal/nfce/${ref}/status`),
  },
}
