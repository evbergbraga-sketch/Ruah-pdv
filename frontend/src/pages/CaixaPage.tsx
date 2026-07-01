import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api, type CaixaInfo, type CaixaResumo } from '../lib/api'

const R = (n: number) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

const FORMA_LABEL: Record<string, string> = {
  dinheiro: '💵 Dinheiro', pix: '📱 PIX', credito: '💳 Crédito', debito: '🏦 Débito',
}

export function CaixaPage() {
  const qc = useQueryClient()
  const [valorAbertura, setValorAbertura] = useState('')
  const [valorFechamento, setValorFechamento] = useState('')

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
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${aberto ? 'bg-green/20' : 'bg-bg3'}`}>
          {aberto ? '🟢' : '🔴'}
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

      {/* Resumo da sessão — só quando caixa aberto */}
      {aberto && resumo && (
        <div className="bg-bg2 border border-border rounded-2xl p-6 space-y-5">
          <div className="font-semibold text-sm text-txt2 uppercase tracking-wider">Resumo da sessão</div>

          {/* Cards de total */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bg3 rounded-xl p-4 text-center">
              <div className="text-2xl font-extrabold text-rose">{resumo.qtd_vendas}</div>
              <div className="text-xs text-txt3 mt-1">Vendas</div>
            </div>
            <div className="bg-bg3 rounded-xl p-4 text-center">
              <div className="text-lg font-extrabold text-green leading-tight">{R(resumo.total_bruto)}</div>
              <div className="text-xs text-txt3 mt-1">Total vendido</div>
            </div>
            <div className="bg-bg3 rounded-xl p-4 text-center">
              <div className="text-lg font-extrabold text-txt leading-tight">{R(resumo.valor_esperado)}</div>
              <div className="text-xs text-txt3 mt-1">Esperado em caixa</div>
            </div>
          </div>

          {/* Por forma de pagamento */}
          {resumo.por_forma.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-txt3 uppercase tracking-wider">Por forma de pagamento</div>
              {resumo.por_forma.map(f => (
                <div key={f.forma} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm">{FORMA_LABEL[f.forma] ?? f.forma}</span>
                  <div className="text-right">
                    <span className="font-semibold text-sm">{R(f.valor)}</span>
                    <span className="text-xs text-txt3 ml-2">({f.qtd} venda{f.qtd !== 1 ? 's' : ''})</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {resumo.qtd_vendas === 0 && (
            <p className="text-sm text-txt3 text-center py-2">Nenhuma venda registrada nesta sessão</p>
          )}
        </div>
      )}

      {/* Ação — abrir ou fechar */}
      {!aberto ? (
        <div className="bg-bg2 border border-border rounded-2xl p-6 space-y-4">
          <div className="font-semibold">Abrir Caixa</div>
          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Valor inicial em dinheiro</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3">R$</span>
              <input
                type="number" placeholder="0,00" value={valorAbertura}
                onChange={e => setValorAbertura(e.target.value)}
                className="w-full bg-bg3 border border-border rounded-xl pl-10 pr-4 py-3 text-base font-mono text-txt outline-none focus:border-green transition-colors"
              />
            </div>
          </div>
          <button onClick={() => abrir.mutate()} disabled={abrir.isPending}
            className="w-full py-3 bg-green text-white font-bold rounded-xl hover:bg-green/90 disabled:opacity-50 transition-colors">
            {abrir.isPending ? 'Abrindo...' : '🔓 Abrir Caixa'}
          </button>
        </div>
      ) : (
        <div className="bg-bg2 border border-border rounded-2xl p-6 space-y-4">
          <div className="font-semibold">Fechar Caixa</div>
          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Valor contado em dinheiro</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3">R$</span>
              <input
                type="number" placeholder="0,00" value={valorFechamento}
                onChange={e => setValorFechamento(e.target.value)}
                className="w-full bg-bg3 border border-border rounded-xl pl-10 pr-4 py-3 text-base font-mono text-txt outline-none focus:border-rose transition-colors"
              />
            </div>
            {resumo && resumo.valor_esperado > 0 && (
              <p className="text-xs text-txt3 mt-1.5">
                Esperado: <span className="font-semibold text-txt">{R(resumo.valor_esperado)}</span>
                {valorFechamento && (
                  <span className={`ml-2 font-semibold ${parseFloat(valorFechamento) >= resumo.valor_esperado ? 'text-green' : 'text-rose'}`}>
                    {parseFloat(valorFechamento) >= resumo.valor_esperado
                      ? `+${R(parseFloat(valorFechamento) - resumo.valor_esperado)}`
                      : `−${R(resumo.valor_esperado - parseFloat(valorFechamento))}`}
                  </span>
                )}
              </p>
            )}
          </div>
          <button onClick={() => fechar.mutate()} disabled={fechar.isPending || !valorFechamento}
            className="w-full py-3 bg-red text-white font-bold rounded-xl hover:bg-red/90 disabled:opacity-50 transition-colors">
            {fechar.isPending ? 'Fechando...' : '🔒 Fechar Caixa'}
          </button>
        </div>
      )}
    </div>
  )
}
