import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { LockOpen, Lock, Banknote, Smartphone, CreditCard, Landmark, Eye } from 'lucide-react'
import { api, type CaixaInfo, type CaixaResumo, type VendaResumo } from '../lib/api'
import { VendaModal } from '../components/shared/VendaModal'

const R = (n: number) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

const FORMA: Record<string, { label: string; Icon: React.ElementType }> = {
  dinheiro: { label: 'Dinheiro', Icon: Banknote   },
  pix:      { label: 'PIX',      Icon: Smartphone  },
  credito:  { label: 'Crédito',  Icon: CreditCard  },
  debito:   { label: 'Débito',   Icon: Landmark    },
}

export function CaixaPage() {
  const qc = useQueryClient()
  const [valorAbertura, setValorAbertura] = useState('')
  const [valorFechamento, setValorFechamento] = useState('')
  const [vendaAberta, setVendaAberta] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['caixa-status'],
    queryFn: () => api.caixa.status(),
    refetchInterval: 30_000,
  })
  const caixaData = data as { caixa: CaixaInfo | null; aberto: boolean } | undefined
  const caixa = caixaData?.caixa
  const aberto = caixaData?.aberto ?? false

  const { data: resumoData } = useQuery({
    queryKey: ['caixa-resumo', caixa?.id],
    queryFn: () => api.caixa.resumo(caixa!.id),
    enabled: !!caixa?.id,
    refetchInterval: 30_000,
  })
  const resumo = resumoData as CaixaResumo | undefined

  const abrir = useMutation({
    mutationFn: () => api.caixa.abrir(parseFloat(valorAbertura || '0')),
    onSuccess: () => { toast.success('Caixa aberto!'); qc.invalidateQueries({ queryKey: ['caixa-status'] }) },
    onError: (e: Error) => toast.error(e.message),
  })
  const fechar = useMutation({
    mutationFn: () => api.caixa.fechar(caixa!.id, parseFloat(valorFechamento || '0')),
    onSuccess: () => {
      toast.success('Caixa fechado!')
      qc.invalidateQueries({ queryKey: ['caixa-status'] })
      qc.invalidateQueries({ queryKey: ['caixa-resumo'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <div className="flex items-center justify-center h-full text-txt3 text-sm">Carregando...</div>

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Caixa</h1>
        <p className="text-sm text-txt3 mt-1">Abertura, fechamento e resumo da sessão</p>
      </div>

      {/* Status */}
      <div className={`rounded-2xl border p-6 flex items-center gap-5 ${aberto ? 'border-green/30 bg-green-dim' : 'border-border bg-bg2'}`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${aberto ? 'bg-green/20 text-green' : 'bg-bg3 text-txt3'}`}>
          {aberto ? <LockOpen size={26} /> : <Lock size={26} />}
        </div>
        <div className="flex-1">
          <div className="font-bold text-base">{aberto ? 'Caixa Aberto' : 'Caixa Fechado'}</div>
          {caixa && (
            <div className="text-sm text-txt2 mt-0.5">
              Aberto às {new Date(caixa.aberto_em).toLocaleTimeString('pt-BR')} · Valor inicial: {R(caixa.valor_abertura)}
            </div>
          )}
        </div>
        {aberto && (
          <div className="text-right">
            <div className="text-xs text-txt3">Desde</div>
            <div className="text-sm font-semibold">{new Date(caixa!.aberto_em).toLocaleDateString('pt-BR')}</div>
          </div>
        )}
      </div>

      {/* Resumo da sessão */}
      {aberto && resumo && (
        <div className="bg-bg2 border border-border rounded-2xl p-6 space-y-5">
          <div className="text-xs font-bold text-txt3 uppercase tracking-wider">Resumo da sessão</div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Vendas',          value: resumo.qtd_vendas.toString(), color: 'text-rose' },
              { label: 'Total vendido',   value: R(resumo.total_bruto),         color: 'text-green' },
              { label: 'Esperado caixa', value: R(resumo.valor_esperado),       color: 'text-txt' },
            ].map(c => (
              <div key={c.label} className="bg-bg3 rounded-xl p-4 text-center">
                <div className={`text-xl font-extrabold ${c.color}`}>{c.value}</div>
                <div className="text-xs text-txt3 mt-1">{c.label}</div>
              </div>
            ))}
          </div>

          {resumo.por_forma.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-txt3 uppercase tracking-wider">Por forma de pagamento</div>
              {resumo.por_forma.map(f => {
                const meta = FORMA[f.forma]
                const Icon = meta?.Icon ?? CreditCard
                return (
                  <div key={f.forma} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="flex items-center gap-2 text-sm text-txt2">
                      <Icon size={15} />{meta?.label ?? f.forma}
                    </span>
                    <div>
                      <span className="font-semibold text-sm">{R(f.valor)}</span>
                      <span className="text-xs text-txt3 ml-2">({f.qtd}x)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Lista de vendas */}
          {resumo.vendas?.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-txt3 uppercase tracking-wider mb-2">Vendas desta sessão</div>
              {resumo.vendas.map((v: VendaResumo) => (
                <button key={v.id} onClick={() => setVendaAberta(v.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg3 transition-colors group">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-txt3">#{String(v.numero).padStart(4, '0')}</span>
                    <span className="text-xs text-txt3">
                      {new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {v.formas && (
                      <span className="text-xs bg-bg3 group-hover:bg-bg2 border border-border px-2 py-0.5 rounded-full text-txt2 transition-colors">
                        {v.formas}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-rose">{R(v.total)}</span>
                    <Eye size={13} className="text-txt3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {resumo.qtd_vendas === 0 && (
            <p className="text-sm text-txt3 text-center py-2">Nenhuma venda nesta sessão</p>
          )}
        </div>
      )}

      {/* Ação */}
      {!aberto ? (
        <div className="bg-bg2 border border-border rounded-2xl p-6 space-y-4">
          <div className="font-semibold">Abrir Caixa</div>
          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Valor inicial em dinheiro</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3 text-sm">R$</span>
              <input type="number" placeholder="0,00" value={valorAbertura}
                onChange={e => setValorAbertura(e.target.value)}
                className="w-full bg-bg3 border border-border rounded-xl pl-10 pr-4 py-3 text-base font-mono text-txt outline-none focus:border-green transition-colors" />
            </div>
          </div>
          <button onClick={() => abrir.mutate()} disabled={abrir.isPending}
            className="w-full py-3 bg-green text-white font-bold rounded-xl hover:bg-green/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <LockOpen size={16} />{abrir.isPending ? 'Abrindo...' : 'Abrir Caixa'}
          </button>
        </div>
      ) : (
        <div className="bg-bg2 border border-border rounded-2xl p-6 space-y-4">
          <div className="font-semibold">Fechar Caixa</div>
          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Valor contado em dinheiro</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3 text-sm">R$</span>
              <input type="number" placeholder="0,00" value={valorFechamento}
                onChange={e => setValorFechamento(e.target.value)}
                className="w-full bg-bg3 border border-border rounded-xl pl-10 pr-4 py-3 text-base font-mono text-txt outline-none focus:border-rose transition-colors" />
            </div>
            {resumo && resumo.valor_esperado > 0 && valorFechamento && (
              <p className="text-xs text-txt3 mt-1.5">
                Esperado: <span className="font-semibold text-txt">{R(resumo.valor_esperado)}</span>
                <span className={`ml-2 font-semibold ${parseFloat(valorFechamento) >= resumo.valor_esperado ? 'text-green' : 'text-rose'}`}>
                  {parseFloat(valorFechamento) >= resumo.valor_esperado
                    ? `+${R(parseFloat(valorFechamento) - resumo.valor_esperado)}`
                    : `−${R(resumo.valor_esperado - parseFloat(valorFechamento))}`}
                </span>
              </p>
            )}
          </div>
          <button onClick={() => fechar.mutate()} disabled={fechar.isPending || !valorFechamento}
            className="w-full py-3 bg-red text-white font-bold rounded-xl hover:bg-red/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <Lock size={16} />{fechar.isPending ? 'Fechando...' : 'Fechar Caixa'}
          </button>
        </div>
      )}

      <VendaModal vendaId={vendaAberta} onFechar={() => setVendaAberta(null)} />
    </div>
  )
}
