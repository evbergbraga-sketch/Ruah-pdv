const BASE = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL)
  ?? 'https://ruahpdv.ruahsystems.com.br'

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('ruah-pdv-auth')
    if (!raw) return null
    return JSON.parse(raw).state?.token ?? null
  } catch {
    return null
  }
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string }
    if (res.status === 401) {
      localStorage.removeItem('ruah-pdv-auth')
      window.location.href = '/login'
    }
    throw new Error(err.error ?? 'Erro desconhecido')
  }
  return res.json() as Promise<T>
}

export interface Produto {
  id: string; nome: string; ean?: string; codigo?: string
  preco_venda: number; preco_custo: number; unidade: string
  estoque: number; categoria?: string; ncm: string; cfop: string; cst: string
  estoque_minimo: number; ativo: boolean
}

export interface ProdutosResponse { produtos: Produto[] }
export interface VendaResponse { venda: { id: string; numero: number; total: number } }
export interface CaixaInfo { id: string; valor_abertura: number; aberto_em: string; operador: string }
export interface CaixaStatusResponse { caixa: CaixaInfo | null; aberto: boolean }
export interface LoginResponse {
  token: string
  user: { id: string; nome: string; email: string; role: string; empresa: string; tenantId: string }
}

export const api = {
  auth: {
    login: (email: string, senha: string) =>
      req<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
    registro: (body: unknown) =>
      req<{ empresa: string; usuario: string; mensagem: string }>('/api/auth/registro', { method: 'POST', body: JSON.stringify(body) }),
    me: () => req<{ user: LoginResponse['user'] }>('/api/auth/me'),
  },
  pdv: {
    buscarProdutos: (q?: string, ean?: string) =>
      req<ProdutosResponse>(`/api/pdv/produtos?${new URLSearchParams({ ...(q ? { q } : {}), ...(ean ? { ean } : {}) })}`),
    criarVenda: (body: unknown) =>
      req<VendaResponse>('/api/pdv/venda', { method: 'POST', body: JSON.stringify(body) }),
    buscarVenda: (id: string) =>
      req<{ venda: unknown }>(`/api/pdv/venda/${id}`),
  },
  estoque: {
    listar: (q?: string) =>
      req<ProdutosResponse>(`/api/estoque/produtos${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    criarProduto: (body: unknown) =>
      req<{ produto: Produto }>('/api/estoque/produtos', { method: 'POST', body: JSON.stringify(body) }),
    atualizarProduto: (id: string, body: unknown) =>
      req<{ produto: Produto }>(`/api/estoque/produtos/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    desativarProduto: (id: string) =>
      req<{ ok: boolean }>(`/api/estoque/produtos/${id}`, { method: 'DELETE' }),
    entrada: (id: string, quantidade: number, motivo?: string) =>
      req<{ ok: boolean }>(`/api/estoque/produtos/${id}/entrada`, { method: 'POST', body: JSON.stringify({ quantidade, motivo }) }),
    saida: (id: string, quantidade: number, motivo?: string) =>
      req<{ ok: boolean }>(`/api/estoque/produtos/${id}/saida`, { method: 'POST', body: JSON.stringify({ quantidade, motivo }) }),
  },
  caixa: {
    status: () => req<CaixaStatusResponse>('/api/caixa/status'),
    abrir: (valor_abertura: number) =>
      req<{ caixa: CaixaInfo }>('/api/caixa/abrir', { method: 'POST', body: JSON.stringify({ valor_abertura }) }),
    fechar: (id: string, valor_fechamento: number, obs?: string) =>
      req<{ caixa: CaixaInfo }>(`/api/caixa/${id}/fechar`, { method: 'POST', body: JSON.stringify({ valor_fechamento, observacoes: obs }) }),
    sangria: (id: string, valor: number, desc?: string) =>
      req<{ movimento: unknown }>(`/api/caixa/${id}/sangria`, { method: 'POST', body: JSON.stringify({ valor, descricao: desc }) }),
    suprimento: (id: string, valor: number, desc?: string) =>
      req<{ movimento: unknown }>(`/api/caixa/${id}/suprimento`, { method: 'POST', body: JSON.stringify({ valor, descricao: desc }) }),
    movimentos: (id: string) => req<{ movimentos: unknown[] }>(`/api/caixa/${id}/movimentos`),
  },
  fiscal: {
    emitirNFCe: (venda_id: string) =>
      req<{ nota: unknown; focus_ref: string }>(`/api/fiscal/nfce/${venda_id}`, { method: 'POST' }),
    statusNFCe: (ref: string) =>
      req<unknown>(`/api/fiscal/nfce/${ref}/status`),
  },
}
