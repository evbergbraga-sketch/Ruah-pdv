import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type RelatorioVendas } from '../lib/api'

const R = (n: number) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

const FORMA_LABEL: Record<string, string> = {
  dinheiro: '💵 Dinheiro', pix: '📱 PIX', credito: '💳 Crédito', debito: '🏦 Débito',
}

type Periodo = 'hoje' | 'semana' | 'mes'

export function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<Periodo>('hoje')

  const { data, isLoading } = useQuery({
    queryKey: ['relatorios-vendas', periodo],
    queryFn: () => api.relatorios.vendas(periodo),
    refetchInterval: 60_000,
  })

  const rel = data as RelatorioVendas | undefined

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Relatórios</h1>
          <p className="text-sm text-txt3 mt-1">Resumo de vendas</p>
        </div>

        {/* Seletor de período */}
        <div className="flex gap-1 bg-bg3 border border-border rounded-xl p-1">
          {([['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês']] as [Periodo, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setPeriodo(v)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodo === v ? 'bg-rose text-white' : 'text-txt2 hover:text-txt'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-txt3 text-sm">Carregando...</div>
      ) : !rel ? null : (
        <>
          {/* Cards de totais */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total vendido', value: R(rel.total_bruto), color: 'text-green' },
              { label: 'Nº de vendas',  value: rel.qtd_vendas.toString(), color: 'text-rose' },
              { label: 'Ticket médio',  value: R(rel.ticket_medio), color: 'text-txt' },
            ].map(c => (
              <div key={c.label} className="bg-bg2 border border-border rounded-2xl p-5">
                <div className="text-xs text-txt3 font-semibold uppercase tracking-wider mb-2">{c.label}</div>
                <div className={`text-2xl font-extrabold ${c.color}`}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Por forma de pagamento */}
            <div className="bg-bg2 border border-border rounded-2xl p-5 space-y-3">
              <div className="text-xs font-semibold text-txt3 uppercase tracking-wider">Por forma de pagamento</div>
              {rel.por_forma.length === 0 ? (
                <p className="text-sm text-txt3">Sem dados</p>
              ) : rel.por_forma.map(f => (
                <div key={f.forma} className="flex items-center justify-between">
                  <span className="text-sm">{FORMA_LABEL[f.forma] ?? f.forma}</span>
                  <div className="text-right">
                    <span className="font-semibold text-sm">{R(f.valor)}</span>
                    <span className="text-xs text-txt3 ml-1.5">{f.qtd}x</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Top produtos */}
            <div className="bg-bg2 border border-border rounded-2xl p-5 space-y-3">
              <div className="text-xs font-semibold text-txt3 uppercase tracking-wider">Top produtos</div>
              {rel.top_produtos.length === 0 ? (
                <p className="text-sm text-txt3">Sem dados</p>
              ) : rel.top_produtos.map((p, i) => (
                <div key={p.nome} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-txt3 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.nome}</div>
                    <div className="text-xs text-txt3">{p.qtd_vendida} un · {R(p.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de vendas */}
          <div className="bg-bg2 border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <span className="text-xs font-semibold text-txt3 uppercase tracking-wider">Vendas do período</span>
            </div>
            {rel.vendas.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-txt3">Nenhuma venda no período</div>
            ) : (
              <div className="divide-y divide-border">
                {rel.vendas.map(v => (
                  <div key={v.numero} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-txt3">#{String(v.numero).padStart(4, '0')}</span>
                      <span className="text-xs text-txt3">
                        {new Date(v.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {v.formas && (
                        <span className="text-xs bg-bg3 border border-border px-2 py-0.5 rounded-full text-txt2">
                          {v.formas}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-sm text-rose">{R(v.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
