const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8010'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem('pdv_token')
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Erro desconhecido')
  }
  return res.json()
}

// ── PDV ──────────────────────────────────────────────────────
export const api = {
  pdv: {
    buscarProdutos: (q?: string, ean?: string) =>
      req<{ produtos: unknown[] }>(`/api/pdv/produtos?${new URLSearchParams({ ...(q?{q}:{}), ...(ean?{ean}:{}) })}`),

    criarVenda: (body: unknown) =>
      req<{ venda: unknown }>('/api/pdv/venda', { method: 'POST', body: JSON.stringify(body) }),

    buscarVenda: (id: string) =>
      req<{ venda: unknown }>(`/api/pdv/venda/${id}`),
  },

  caixa: {
    status: () =>
      req<{ caixa: unknown; aberto: boolean }>('/api/caixa/status'),
    abrir: (valor_abertura: number) =>
      req<{ caixa: unknown }>('/api/caixa/abrir', { method: 'POST', body: JSON.stringify({ valor_abertura }) }),
    fechar: (id: string, valor_fechamento: number, obs?: string) =>
      req<{ caixa: unknown }>(`/api/caixa/${id}/fechar`, { method: 'POST', body: JSON.stringify({ valor_fechamento, observacoes: obs }) }),
    sangria: (id: string, valor: number, desc?: string) =>
      req<{ movimento: unknown }>(`/api/caixa/${id}/sangria`, { method: 'POST', body: JSON.stringify({ valor, descricao: desc }) }),
    suprimento: (id: string, valor: number, desc?: string) =>
      req<{ movimento: unknown }>(`/api/caixa/${id}/suprimento`, { method: 'POST', body: JSON.stringify({ valor, descricao: desc }) }),
  },

  fiscal: {
    emitirNFCe: (venda_id: string) =>
      req<{ nota: unknown; focus_ref: string }>(`/api/fiscal/nfce/${venda_id}`, { method: 'POST' }),
    statusNFCe: (ref: string) =>
      req<unknown>(`/api/fiscal/nfce/${ref}/status`),
    cancelarNFCe: (ref: string, justificativa: string) =>
      req<unknown>(`/api/fiscal/nfce/${ref}`, { method: 'DELETE', body: JSON.stringify({ justificativa }) }),
  },
}
