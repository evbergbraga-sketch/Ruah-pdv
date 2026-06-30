import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, type Produto } from '../lib/api'

const EMPTY_FORM = {
  nome: '', ean: '', codigo: '', preco_venda: '', preco_custo: '',
  unidade: 'UN', ncm: '33049900', estoque_minimo: '5', cfop: '5102', cst: '400',
}

export function EstoquePage() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [estoqueInicial, setEstoqueInicial] = useState('0')
  const [ajustando, setAjustando] = useState<Produto | null>(null)
  const [tipoAjuste, setTipoAjuste] = useState<'entrada' | 'saida'>('entrada')
  const [qtdAjuste, setQtdAjuste] = useState('')
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [excluindo, setExcluindo] = useState<Produto | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['estoque-produtos', busca],
    queryFn: () => api.estoque.listar(busca || undefined),
  })

  const criar = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.estoque.criarProduto(body),
    onSuccess: () => {
      toast.success('Produto cadastrado!')
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      fecharForm()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const atualizar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.estoque.atualizarProduto(id, body),
    onSuccess: () => {
      toast.success('Produto atualizado!')
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      fecharForm()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const ajustarEstoque = useMutation({
    mutationFn: ({ id, tipo, qtd, motivo }: { id: string; tipo: 'entrada' | 'saida'; qtd: number; motivo?: string }) =>
      tipo === 'entrada' ? api.estoque.entrada(id, qtd, motivo) : api.estoque.saida(id, qtd, motivo),
    onSuccess: () => {
      toast.success(tipoAjuste === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!')
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      fecharAjuste()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.estoque.desativarProduto(id),
    onSuccess: () => {
      toast.success('Produto excluído!')
      qc.invalidateQueries({ queryKey: ['estoque-produtos'] })
      setExcluindo(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const produtos: Produto[] = data?.produtos ?? []

  function abrirNovo() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setEstoqueInicial('0')
    setShowForm(true)
  }

  function abrirEdicao(p: Produto) {
    setEditando(p)
    setForm({
      nome: p.nome,
      ean: p.ean ?? '',
      codigo: p.codigo ?? '',
      preco_venda: String(p.preco_venda),
      preco_custo: String(p.preco_custo ?? 0),
      unidade: p.unidade,
      ncm: p.ncm,
      cfop: p.cfop,
      cst: p.cst,
      estoque_minimo: String(p.estoque_minimo ?? 5),
    })
    setShowForm(true)
  }

  function fecharForm() {
    setShowForm(false)
    setEditando(null)
    setForm(EMPTY_FORM)
    setEstoqueInicial('0')
  }

  function abrirAjuste(p: Produto) {
    setAjustando(p)
    setTipoAjuste('entrada')
    setQtdAjuste('')
    setMotivoAjuste('')
  }

  function fecharAjuste() {
    setAjustando(null)
    setQtdAjuste('')
    setMotivoAjuste('')
  }

  function confirmarAjuste() {
    const qtd = parseInt(qtdAjuste)
    if (!qtd || qtd <= 0) return toast.error('Quantidade inválida')
    if (!ajustando) return
    ajustarEstoque.mutate({ id: ajustando.id, tipo: tipoAjuste, qtd, motivo: motivoAjuste || undefined })
  }

  function salvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório')
    if (!form.preco_venda) return toast.error('Preço de venda é obrigatório')

    const payload = {
      nome: form.nome,
      ean: form.ean || undefined,
      codigo: form.codigo || undefined,
      preco_venda: parseFloat(form.preco_venda),
      preco_custo: parseFloat(form.preco_custo || '0'),
      unidade: form.unidade,
      ncm: form.ncm,
      cfop: form.cfop,
      cst: form.cst,
      estoque_minimo: parseInt(form.estoque_minimo),
    }

    if (editando) {
      atualizar.mutate({ id: editando.id, body: payload })
    } else {
      criar.mutate({ ...payload, estoque_inicial: parseInt(estoqueInicial) })
    }
  }

  const statusEstoque = (qtd: number) => {
    if (qtd === 0) return { label: 'Zerado', color: 'text-red bg-red/10 border-red/20' }
    if (qtd <= 5) return { label: 'Baixo', color: 'text-gold bg-gold/10 border-gold/20' }
    return { label: 'OK', color: 'text-green bg-green/10 border-green/20' }
  }

  const salvando = criar.isPending || atualizar.isPending

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Estoque</h1>
          <p className="text-sm text-txt3 mt-1">Catálogo e controle de produtos</p>
        </div>
        <button
          onClick={abrirNovo}
          className="px-4 py-2 bg-rose text-white text-sm font-bold rounded-lg hover:bg-rose/90 transition-colors"
        >
          + Novo Produto
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total produtos', val: produtos.length, color: 'text-rose' },
          { label: 'Sem estoque', val: produtos.filter(p => p.estoque === 0).length, color: 'text-red' },
          { label: 'Estoque baixo', val: produtos.filter(p => p.estoque > 0 && p.estoque <= 5).length, color: 'text-gold' },
          { label: 'Em estoque', val: produtos.filter(p => p.estoque > 5).length, color: 'text-green' },
        ].map(m => (
          <div key={m.label} className="bg-bg2 border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-txt3 uppercase tracking-wider">{m.label}</div>
            <div className={`text-3xl font-extrabold mt-1 ${m.color}`}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Busca */}
      <input
        type="text"
        placeholder="🔍 Buscar produto, EAN ou código..."
        value={busca}
        onChange={e => setBusca(e.target.value)}
        className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt placeholder:text-txt3 outline-none focus:border-rose transition-colors"
      />

      {/* Tabela */}
      <div className="bg-bg2 border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {['Produto', 'Código / EAN', 'Preço', 'Custo', 'Estoque', 'Status', ''].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-txt3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-txt3 text-sm">Carregando...</td></tr>
            ) : produtos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center">
                  <div className="text-txt3 text-sm">
                    {busca ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado ainda'}
                  </div>
                  {!busca && (
                    <button onClick={abrirNovo} className="mt-3 text-rose text-sm font-semibold hover:underline">
                      Cadastrar primeiro produto →
                    </button>
                  )}
                </td>
              </tr>
            ) : produtos.map(p => {
              const st = statusEstoque(p.estoque ?? 0)
              return (
                <tr key={p.id} className="border-b border-border hover:bg-bg3 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-sm">{p.nome}</div>
                    <div className="text-xs text-txt3 mt-0.5">NCM: {p.ncm}</div>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-txt2">
                    {p.codigo && <div>{p.codigo}</div>}
                    {p.ean && <div className="text-txt3">{p.ean}</div>}
                    {!p.codigo && !p.ean && <span className="text-txt3">—</span>}
                  </td>
                  <td className="px-5 py-4 font-bold text-rose text-sm">
                    R$ {Number(p.preco_venda).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-5 py-4 text-txt3 text-sm">
                    R$ {Number(p.preco_custo ?? 0).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-bg4 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.estoque === 0 ? 'bg-red' : p.estoque <= 5 ? 'bg-gold' : 'bg-green'}`}
                          style={{ width: `${Math.min(100, (p.estoque / 50) * 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold">{p.estoque ?? 0}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${st.color}`}>
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {st.label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => abrirAjuste(p)}
                        className="text-xs text-txt3 hover:text-mint transition-colors font-medium"
                      >
                        Ajustar
                      </button>
                      <button
                        onClick={() => abrirEdicao(p)}
                        className="text-xs text-txt3 hover:text-rose transition-colors font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setExcluindo(p)}
                        className="text-xs text-txt3 hover:text-red transition-colors font-medium"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de cadastro/edição */}
      {showForm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg2 border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="text-base font-bold">{editando ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={fecharForm} className="text-txt3 hover:text-txt text-xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Nome *</label>
                <input
                  type="text"
                  placeholder="Ex: Base Líquida HD Pro"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">EAN / Código de Barras</label>
                  <input
                    type="text"
                    placeholder="7896016100016"
                    value={form.ean}
                    onChange={e => setForm(f => ({ ...f, ean: e.target.value }))}
                    className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Código Interno</label>
                  <input
                    type="text"
                    placeholder="001"
                    value={form.codigo}
                    onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                    className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Preço de Venda *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={form.preco_venda}
                      onChange={e => setForm(f => ({ ...f, preco_venda: e.target.value }))}
                      className="w-full bg-bg3 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Preço de Custo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={form.preco_custo}
                      onChange={e => setForm(f => ({ ...f, preco_custo: e.target.value }))}
                      className="w-full bg-bg3 border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">
                    {editando ? 'Estoque Atual' : 'Estoque Inicial'}
                  </label>
                  {editando ? (
                    <button
                      type="button"
                      onClick={() => { fecharForm(); abrirAjuste(editando) }}
                      className="w-full bg-bg4 border border-border rounded-lg px-3 py-2.5 text-sm text-txt3 text-left hover:border-mint transition-colors"
                    >
                      {editando.estoque} un — <span className="text-mint font-semibold">ajustar estoque →</span>
                    </button>
                  ) : (
                    <input
                      type="number"
                      placeholder="0"
                      value={estoqueInicial}
                      onChange={e => setEstoqueInicial(e.target.value)}
                      className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Estoque Mínimo</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={form.estoque_minimo}
                    onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))}
                    className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Unidade</label>
                  <select
                    value={form.unidade}
                    onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))}
                    className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors"
                  >
                    {['UN', 'KG', 'L', 'CX', 'PC'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="border border-border/50 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-txt3 uppercase tracking-wider">Dados Fiscais (NFC-e)</div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-txt3 block mb-1">NCM</label>
                    <input
                      type="text"
                      value={form.ncm}
                      onChange={e => setForm(f => ({ ...f, ncm: e.target.value }))}
                      className="w-full bg-bg3 border border-border rounded-lg px-3 py-2 text-xs font-mono text-txt outline-none focus:border-rose"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-txt3 block mb-1">CFOP</label>
                    <input
                      type="text"
                      value={form.cfop}
                      onChange={e => setForm(f => ({ ...f, cfop: e.target.value }))}
                      className="w-full bg-bg3 border border-border rounded-lg px-3 py-2 text-xs font-mono text-txt outline-none focus:border-rose"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-txt3 block mb-1">CST</label>
                    <input
                      type="text"
                      value={form.cst}
                      onChange={e => setForm(f => ({ ...f, cst: e.target.value }))}
                      className="w-full bg-bg3 border border-border rounded-lg px-3 py-2 text-xs font-mono text-txt outline-none focus:border-rose"
                    />
                  </div>
                </div>
                <p className="text-xs text-txt3">NCM 33049900 = cosméticos (padrão para maquiagem)</p>
              </div>

              {form.preco_venda && form.preco_custo && parseFloat(form.preco_venda) > 0 && (
                <div className="bg-green-dim border border-green/20 rounded-lg px-4 py-3 text-sm">
                  <span className="text-txt2">Margem de lucro: </span>
                  <span className="font-bold text-green">
                    {(((parseFloat(form.preco_venda) - parseFloat(form.preco_custo)) / parseFloat(form.preco_venda)) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-border">
              <button
                onClick={fecharForm}
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-semibold text-txt2 hover:text-txt hover:border-border/80 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 px-4 py-2.5 bg-rose text-white rounded-lg text-sm font-bold hover:bg-rose/90 disabled:opacity-50 transition-colors"
              >
                {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de ajuste de estoque */}
      {ajustando && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg2 border border-border rounded-2xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold">Ajustar Estoque</h2>
              <p className="text-sm text-txt3 mt-1">{ajustando.nome} — atual: <span className="text-txt font-semibold">{ajustando.estoque} un</span></p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTipoAjuste('entrada')}
                className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                  tipoAjuste === 'entrada' ? 'bg-green-dim border-green text-green' : 'bg-bg3 border-border text-txt2'
                }`}
              >
                📥 Entrada
              </button>
              <button
                onClick={() => setTipoAjuste('saida')}
                className={`py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                  tipoAjuste === 'saida' ? 'bg-red/10 border-red text-red' : 'bg-bg3 border-border text-txt2'
                }`}
              >
                📤 Saída
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Quantidade</label>
              <input
                autoFocus
                type="number"
                placeholder="0"
                value={qtdAjuste}
                onChange={e => setQtdAjuste(e.target.value)}
                className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-base text-txt outline-none focus:border-rose transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Motivo (opcional)</label>
              <input
                type="text"
                placeholder={tipoAjuste === 'entrada' ? 'Ex: Compra de fornecedor' : 'Ex: Produto danificado'}
                value={motivoAjuste}
                onChange={e => setMotivoAjuste(e.target.value)}
                className="w-full bg-bg3 border border-border rounded-lg px-3 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={fecharAjuste} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold text-txt2 hover:text-txt transition-colors">
                Cancelar
              </button>
              <button
                onClick={confirmarAjuste}
                disabled={ajustarEstoque.isPending}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-colors ${
                  tipoAjuste === 'entrada' ? 'bg-green hover:bg-green/90' : 'bg-red hover:bg-red/90'
                }`}
              >
                {ajustarEstoque.isPending ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {excluindo && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg2 border border-border rounded-2xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-red">Excluir Produto</h2>
              <p className="text-sm text-txt2 mt-2">
                Tem certeza que deseja excluir <span className="font-semibold text-txt">{excluindo.nome}</span>?
              </p>
              <p className="text-xs text-txt3 mt-1">O produto será desativado e não aparecerá mais no PDV ou Estoque.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setExcluindo(null)} className="flex-1 py-2.5 border border-border rounded-lg text-sm font-semibold text-txt2 hover:text-txt transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => excluir.mutate(excluindo.id)}
                disabled={excluir.isPending}
                className="flex-1 py-2.5 bg-red text-white rounded-lg text-sm font-bold hover:bg-red/90 disabled:opacity-50 transition-colors"
              >
                {excluir.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
