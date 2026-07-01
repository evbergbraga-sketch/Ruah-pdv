import { useQuery } from '@tanstack/react-query'
import { X, Receipt, CreditCard, Banknote, Smartphone, Landmark } from 'lucide-react'
import { api } from '../../lib/api'

interface VendaModalProps {
  vendaId: string | null
  onFechar: () => void
}

const R = (n: number | string) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`

const FORMA_ICON: Record<string, React.ReactNode> = {
  dinheiro: <Banknote size={14} />,
  pix:      <Smartphone size={14} />,
  credito:  <CreditCard size={14} />,
  debito:   <Landmark size={14} />,
}
const FORMA_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito',
}

export function VendaModal({ vendaId, onFechar }: VendaModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['venda-detalhe', vendaId],
    queryFn: () => api.pdv.buscarVenda(vendaId!),
    enabled: !!vendaId,
  })

  if (!vendaId) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (data as any)?.venda

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="bg-bg2 border border-border rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-rose" />
            <span className="font-bold text-sm">
              {v ? `Venda #${String(v.numero).padStart(4, '0')}` : 'Detalhe da Venda'}
            </span>
          </div>
          <button onClick={onFechar} className="text-txt3 hover:text-txt transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-txt3 text-sm">Carregando...</div>
          ) : !v ? (
            <div className="flex items-center justify-center py-12 text-txt3 text-sm">Venda não encontrada</div>
          ) : (
            <>
              {/* Meta */}
              <div className="px-6 py-3 border-b border-border flex items-center justify-between text-xs text-txt3">
                <span>{new Date(v.created_at).toLocaleString('pt-BR')}</span>
                {v.loja_nome && <span className="truncate max-w-[160px] text-right">{v.loja_nome}</span>}
              </div>

              {/* Itens */}
              <div className="px-6 py-4 space-y-1">
                <div className="text-xs font-semibold text-txt3 uppercase tracking-wider mb-3">Itens</div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(v.itens as any[])?.filter(Boolean).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.nome}</div>
                      <div className="text-xs text-txt3">{item.quantidade}× {R(item.preco_unitario)}</div>
                    </div>
                    <div className="font-semibold text-sm shrink-0 ml-4">{R(item.subtotal)}</div>
                  </div>
                ))}
              </div>

              {/* Totais */}
              <div className="px-6 pb-4 space-y-1.5 border-t border-border pt-3">
                {v.desconto_valor > 0 && (
                  <div className="flex justify-between text-xs text-gold">
                    <span>Desconto</span><span>— {R(v.desconto_valor)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-base">
                  <span>Total</span><span className="text-rose">{R(v.total)}</span>
                </div>
                {v.troco > 0 && (
                  <div className="flex justify-between text-xs text-green font-semibold">
                    <span>Troco</span><span>{R(v.troco)}</span>
                  </div>
                )}
              </div>

              {/* Pagamentos */}
              <div className="px-6 pb-5 border-t border-border pt-3 space-y-1.5">
                <div className="text-xs font-semibold text-txt3 uppercase tracking-wider mb-2">Pagamento</div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(v.pagamentos as any[])?.filter(Boolean).map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-txt2">
                      {FORMA_ICON[p.forma] ?? <CreditCard size={14} />}
                      {FORMA_LABEL[p.forma] ?? p.forma}
                    </span>
                    <span className="font-semibold">{R(p.valor)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
