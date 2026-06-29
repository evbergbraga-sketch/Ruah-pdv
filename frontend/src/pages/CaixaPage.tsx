import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

interface CaixaData { id: string; valor_abertura: number; aberto_em: string; operador: string }

const R = (n: number) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

export function CaixaPage() {
  const qc = useQueryClient()
  const [valorAbertura, setValorAbertura] = useState('')
  const [valorFechamento, setValorFechamento] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['caixa-status'],
    queryFn: () => api.caixa.status(),
    refetchInterval: 30_000,
  })

  const caixaData = data as { caixa: CaixaData | null; aberto: boolean } | undefined
  const caixa = caixaData?.caixa
  const aberto = caixaData?.aberto ?? false

  const abrir = useMutation({
    mutationFn: () => api.caixa.abrir(parseFloat(valorAbertura || '0')),
    onSuccess: () => { toast.success('Caixa aberto!'); qc.invalidateQueries({ queryKey: ['caixa-status'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const fechar = useMutation({
    mutationFn: () => api.caixa.fechar(caixa!.id, parseFloat(valorFechamento || '0')),
    onSuccess: () => { toast.success('Caixa fechado!'); qc.invalidateQueries({ queryKey: ['caixa-status'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading) return <div className="flex items-center justify-center h-full text-txt3 text-sm">Carregando...</div>

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Caixa</h1>
        <p className="text-sm text-txt3 mt-1">Abertura e fechamento do caixa</p>
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
        {aberto && <div className="text-right"><div className="text-xs text-txt3">Desde</div><div className="text-sm font-semibold">{new Date(caixa!.aberto_em).toLocaleDateString('pt-BR')}</div></div>}
      </div>

      {/* Ação */}
      {!aberto ? (
        <div className="bg-bg2 border border-border rounded-2xl p-6 space-y-4">
          <div className="font-semibold">Abrir Caixa</div>
          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Valor inicial em dinheiro</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-txt3">R$</span>
              <input
                type="number"
                placeholder="0,00"
                value={valorAbertura}
                onChange={e => setValorAbertura(e.target.value)}
                className="w-full bg-bg3 border border-border rounded-xl pl-10 pr-4 py-3 text-base font-mono text-txt outline-none focus:border-green transition-colors"
              />
            </div>
          </div>
          <button
            onClick={() => abrir.mutate()}
            disabled={abrir.isPending}
            className="w-full py-3 bg-green text-white font-bold rounded-xl hover:bg-green/90 disabled:opacity-50 transition-colors"
          >
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
                type="number"
                placeholder="0,00"
                value={valorFechamento}
                onChange={e => setValorFechamento(e.target.value)}
                className="w-full bg-bg3 border border-border rounded-xl pl-10 pr-4 py-3 text-base font-mono text-txt outline-none focus:border-rose transition-colors"
              />
            </div>
          </div>
          <button
            onClick={() => fechar.mutate()}
            disabled={fechar.isPending || !valorFechamento}
            className="w-full py-3 bg-red text-white font-bold rounded-xl hover:bg-red/90 disabled:opacity-50 transition-colors"
          >
            {fechar.isPending ? 'Fechando...' : '🔒 Fechar Caixa'}
          </button>
        </div>
      )}
    </div>
  )
}
