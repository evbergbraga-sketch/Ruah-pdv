import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { usePDV } from '../store/pdv'
import { ScannerModal } from '../components/shared/ScannerModal'

interface Produto {
  id: string; nome: string; ean?: string; codigo?: string
  preco_venda: number; unidade: string; estoque: number; cat_cor?: string
}

const FORMAS = [
  { id: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { id: 'pix',     label: 'PIX',      icon: '📱' },
  { id: 'credito', label: 'Crédito',  icon: '💳' },
  { id: 'debito',  label: 'Débito',   icon: '🏦' },
]

const R = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

export function PDVPage() {
  const [busca, setBusca] = useState('')
  const [scanner, setScanner] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [forma, setForma] = useState('dinheiro')
  const [recebido, setRecebido] = useState('')
  const [sucesso, setSucesso] = useState<{ numero: number; total: number; troco: number } | null>(null)
  const buscaRef = useRef<HTMLInputElement>(null)

  const { itens, total, subtotal, descontoVenda, addProduto, remover, setQtd, setDescVenda, limpar } = usePDV()

  const { data } = useQuery({
    queryKey: ['pdv-produtos', busca],
    queryFn: () => api.pdv.buscarProdutos(busca || undefined),
    placeholderData: (prev) => prev,
  })

  const finalizar = useMutation({
    mutationFn: (body: unknown) => api.pdv.criarVenda(body),
    onSuccess: (res: { venda: { numero: number; total: number } }) => {
      setSucesso({ numero: res.venda.numero, total: res.venda.total, troco: Math.max(0, parseFloat(recebido || '0') - res.venda.total) })
      setPagando(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const produtos: Produto[] = (data as { produtos: Produto[] })?.produtos ?? []

  function handleScan(codigo: string) {
    const prod = produtos.find(p => p.ean === codigo || p.codigo === codigo)
    if (prod) { addProduto(prod); toast.success(`✓ ${prod.nome}`) }
    else toast.error(`Produto não encontrado: ${codigo}`)
  }

  function confirmarPagamento() {
    if (itens.length === 0) return
    const totalPago = parseFloat(recebido || String(total))
    if (totalPago < total - 0.01) return toast.error('Valor insuficiente')

    finalizar.mutate({
      itens: itens.map(i => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        desconto_valor: i.desconto_valor,
      })),
      pagamentos: [{ forma, valor: totalPago }],
      desconto_valor: descontoVenda,
    })
  }

  // F2 = nova venda, F8 = pagar, F3 = scanner
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); limpar(); buscaRef.current?.focus() }
      if (e.key === 'F8') { e.preventDefault(); if (itens.length > 0) setPagando(true) }
      if (e.key === 'F3') { e.preventDefault(); setScanner(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [itens.length, limpar])

  const troco = Math.max(0, parseFloat(recebido || '0') - total)

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Esquerda — produtos */}
      <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-border flex gap-2">
          <input
            ref={buscaRef}
            type="text"
            placeholder="🔍 Buscar produto ou código EAN..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="flex-1 bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt placeholder:text-txt3 outline-none focus:border-rose transition-colors"
          />
          <button
            onClick={() => setScanner(true)}
            className="px-4 py-2.5 bg-rose-dim border border-rose text-rose text-sm font-semibold rounded-lg hover:bg-rose hover:text-white transition-all flex items-center gap-2"
          >
            📷 <span className="hidden sm:inline">Escanear</span>
            <span className="text-xs opacity-60 font-mono">F3</span>
          </button>
        </div>

        {/* Grade de produtos */}
        <div className="flex-1 overflow-y-auto p-4">
          {produtos.length === 0 && !busca ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-txt3">
              <div className="text-5xl opacity-20">📦</div>
              <div className="text-sm">Nenhum produto cadastrado</div>
              <a href="/estoque" className="text-rose text-sm font-semibold hover:underline">Cadastrar produtos →</a>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {produtos.filter(p => p.estoque > 0 || !busca).map(p => (
                <button
                  key={p.id}
                  onClick={() => addProduto(p)}
                  disabled={p.estoque === 0}
                  className="bg-bg2 border border-border rounded-xl p-4 text-left hover:border-rose hover:bg-bg3 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  <div className="text-sm font-semibold leading-tight mb-2">{p.nome}</div>
                  <div className="text-rose font-bold text-base">{R(p.preco_venda)}</div>
                  <div className={`text-xs mt-1 ${p.estoque <= 5 ? 'text-gold' : 'text-txt3'}`}>
                    {p.estoque === 0 ? '❌ Sem estoque' : `${p.estoque} un`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Atalhos */}
        <div className="px-4 py-2 border-t border-border flex gap-4 text-xs text-txt3">
          {[['F2', 'Nova venda'], ['F3', 'Scanner'], ['F8', 'Pagar']].map(([k, l]) => (
            <span key={k}><span className="font-mono bg-bg3 border border-border px-1.5 py-0.5 rounded text-txt2">{k}</span> {l}</span>
          ))}
        </div>
      </div>

      {/* Direita — carrinho */}
      <div className="w-80 xl:w-96 flex flex-col bg-bg2">
        <div className="px-4 py-3 border-b border-border flex justify-between items-center">
          <span className="text-xs font-bold text-txt2 uppercase tracking-wider">Venda Atual</span>
          {itens.length > 0 && (
            <button onClick={limpar} className="text-xs text-txt3 hover:text-red transition-colors">Limpar</button>
          )}
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto">
          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-txt3 gap-2">
              <div className="text-4xl opacity-20">🛒</div>
              <div className="text-sm">Clique em um produto</div>
            </div>
          ) : itens.map(item => (
            <div key={item.produto.id} className="px-4 py-3 border-b border-border">
              <div className="flex justify-between items-start">
                <div className="font-medium text-sm flex-1 pr-2">{item.produto.nome}</div>
                <div className="font-bold text-sm text-rose shrink-0">{R(item.preco_unitario * item.quantidade - item.desconto_valor)}</div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => setQtd(item.produto.id, item.quantidade - 1)} className="w-6 h-6 rounded-md bg-bg3 border border-border text-txt2 text-sm hover:border-rose hover:text-rose transition-colors flex items-center justify-center">−</button>
                <span className="text-sm font-semibold w-6 text-center">{item.quantidade}</span>
                <button onClick={() => setQtd(item.produto.id, item.quantidade + 1)} className="w-6 h-6 rounded-md bg-bg3 border border-border text-txt2 text-sm hover:border-rose hover:text-rose transition-colors flex items-center justify-center">+</button>
                <span className="text-xs text-txt3 flex-1">× {R(item.preco_unitario)}</span>
                <button onClick={() => remover(item.produto.id)} className="text-xs text-txt3 hover:text-red transition-colors">✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Totais */}
        {itens.length > 0 && (
          <div className="border-t border-border px-4 py-3 space-y-2">
            <div className="flex justify-between text-xs text-txt2">
              <span>Subtotal</span><span>{R(subtotal)}</span>
            </div>
            {descontoVenda > 0 && (
              <div className="flex justify-between text-xs text-gold">
                <span>Desconto</span><span>— {R(descontoVenda)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-lg">
              <span>Total</span><span className="text-rose">{R(total)}</span>
            </div>
          </div>
        )}

        {/* Botão pagar */}
        <button
          onClick={() => setPagando(true)}
          disabled={itens.length === 0}
          className="mx-4 mb-4 py-3.5 bg-rose text-white font-bold text-sm rounded-xl hover:bg-rose/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          💳 Ir para Pagamento
          <span className="text-xs font-mono opacity-70 bg-white/10 px-1.5 py-0.5 rounded">F8</span>
        </button>
      </div>

      {/* Scanner */}
      <ScannerModal aberto={scanner} contexto="pdv" onCodigo={handleScan} onFechar={() => setScanner(false)} />

      {/* Modal Pagamento */}
      {pagando && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg2 border border-border rounded-2xl w-full max-w-md space-y-5 p-7">
            <div>
              <div className="text-xs font-semibold text-txt3 uppercase tracking-wider">Total a pagar</div>
              <div className="text-5xl font-extrabold text-rose tracking-tight mt-1">{R(total)}</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setForma(f.id)}
                  className={`py-3 rounded-xl border text-sm font-semibold flex flex-col items-center gap-1.5 transition-all ${
                    forma === f.id ? 'bg-rose-dim border-rose text-rose' : 'bg-bg3 border-border text-txt2 hover:text-txt'
                  }`}
                >
                  <span className="text-xl">{f.icon}</span>{f.label}
                </button>
              ))}
            </div>

            {forma === 'dinheiro' && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-txt3 uppercase tracking-wider">Valor recebido</label>
                <input
                  autoFocus
                  type="number"
                  placeholder={total.toFixed(2)}
                  value={recebido}
                  onChange={e => setRecebido(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmarPagamento()}
                  className="w-full bg-bg3 border-2 border-border rounded-xl px-4 py-3 text-2xl font-bold font-mono text-txt outline-none focus:border-green transition-colors text-center"
                />
                {troco > 0 && (
                  <div className="flex justify-between items-center bg-green-dim border border-green/20 rounded-xl px-4 py-3">
                    <span className="text-green text-sm font-semibold uppercase tracking-wider">Troco</span>
                    <span className="text-green text-2xl font-extrabold font-mono">{R(troco)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setPagando(false)} className="flex-1 py-3 border border-border rounded-xl text-sm font-semibold text-txt2 hover:text-txt transition-colors">Cancelar</button>
              <button
                onClick={confirmarPagamento}
                disabled={finalizar.isPending}
                className="flex-[2] py-3 bg-green text-white rounded-xl text-sm font-bold hover:bg-green/90 disabled:opacity-50 transition-colors"
              >
                {finalizar.isPending ? 'Finalizando...' : '✓ Finalizar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sucesso */}
      {sucesso && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col items-center justify-center gap-5">
          <div className="text-7xl animate-bounce">✅</div>
          <div className="text-3xl font-extrabold text-green">Venda Finalizada!</div>
          <div className="text-txt2 text-lg">Venda #{String(sucesso.numero).padStart(4, '0')} · {R(sucesso.total)}</div>
          {sucesso.troco > 0 && (
            <div className="bg-green-dim border border-green/20 rounded-xl px-8 py-4 text-center">
              <div className="text-xs text-green font-semibold uppercase tracking-wider">Troco</div>
              <div className="text-4xl font-extrabold text-green font-mono">{R(sucesso.troco)}</div>
            </div>
          )}
          <div className="flex gap-3 mt-2">
            <button className="px-6 py-3 border border-border bg-bg3 text-txt rounded-xl text-sm font-semibold hover:bg-bg4 transition-colors">🖨️ Imprimir</button>
            <button
              onClick={() => { setSucesso(null); limpar() }}
              className="px-8 py-3 bg-rose text-white rounded-xl text-sm font-bold hover:bg-rose/90 transition-colors"
            >
              ➕ Nova Venda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
