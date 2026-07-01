import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ShieldCheck, LogOut, Plus, Users, Building2, X, Check,
  MessageCircle, ReceiptText, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { api, type Empresa } from '../../lib/api'
import { useSuperAdmin } from '../../store/superadmin'

const PLANOS = ['basico', 'pro', 'enterprise']

export function SuperAdminDashboard() {
  const navigate = useNavigate()
  const { admin, logout } = useSuperAdmin()
  const qc = useQueryClient()
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<Empresa | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sa-empresas'],
    queryFn: () => api.superadmin.listarEmpresas(),
  })
  const empresas = data?.empresas ?? []

  function sair() { logout(); navigate('/superadmin/login') }

  return (
    <div className="min-h-screen">
      <nav className="h-14 border-b border-border flex items-center px-6 gap-3">
        <ShieldCheck size={17} className="text-rose" />
        <span className="font-extrabold text-sm">Painel Master</span>
        <span className="text-xs text-txt3 ml-1">Ruah Systems</span>
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-txt3">{admin?.nome}</span>
          <button onClick={sair} className="flex items-center gap-1.5 text-xs text-txt3 hover:text-red transition-colors font-medium">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Empresas</h1>
            <p className="text-sm text-txt3 mt-1">{empresas.length} empresa{empresas.length !== 1 ? 's' : ''} cadastrada{empresas.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setCriando(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose text-white font-bold rounded-xl hover:bg-rose/90 transition-colors text-sm">
            <Plus size={15} /> Nova Empresa
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-txt3 text-sm">Carregando...</div>
        ) : empresas.length === 0 ? (
          <div className="bg-bg2 border border-border rounded-2xl p-16 text-center">
            <Building2 size={40} className="mx-auto opacity-20 mb-3" />
            <p className="text-sm text-txt3">Nenhuma empresa cadastrada ainda</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {empresas.map(e => (
              <button key={e.id} onClick={() => setEditando(e)}
                className="text-left bg-bg2 border border-border rounded-2xl p-5 hover:border-rose/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${e.ativo ? 'bg-green' : 'bg-red'}`} />
                    <div>
                      <div className="font-bold text-sm">{e.nome}</div>
                      <div className="text-xs text-txt3">{e.razaoSocial} · {e.cnpj}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="px-2 py-1 rounded-full bg-bg3 border border-border text-txt2 uppercase font-semibold text-[10px]">{e.plano}</span>
                    <span className="flex items-center gap-1 text-txt3"><Users size={12} />{e.qtdUsuarios}/{e.limiteUsuarios}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge on={e.permiteCrm} label="CRM" />
                  <Badge on={e.permiteMensagens} label="Mensagens" icon={<MessageCircle size={11} />} />
                  <Badge on={e.permiteCupomFiscal} label="Cupom Fiscal" icon={<ReceiptText size={11} />} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {criando && <ModalCriarEmpresa onFechar={() => setCriando(false)} onCriado={() => { setCriando(false); qc.invalidateQueries({ queryKey: ['sa-empresas'] }) }} />}
      {editando && <ModalEditarEmpresa empresa={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); qc.invalidateQueries({ queryKey: ['sa-empresas'] }) }} />}
    </div>
  )
}

function Badge({ on, label, icon }: { on: boolean; label: string; icon?: React.ReactNode }) {
  return (
    <span className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border ${
      on ? 'bg-green-dim border-green/30 text-green' : 'bg-bg3 border-border text-txt3'
    }`}>
      {icon}{label}
    </span>
  )
}

function ModalCriarEmpresa({ onFechar, onCriado }: { onFechar: () => void; onCriado: () => void }) {
  const [f, setF] = useState({
    nomeEmpresa: '', cnpj: '', razaoSocial: '', telefone: '',
    nomeAdmin: '', email: '', senha: '',
    plano: 'basico', limiteUsuarios: 3,
    permiteCrm: true, permiteMensagens: false, permiteCupomFiscal: false,
  })

  const criar = useMutation({
    mutationFn: () => api.superadmin.criarEmpresa(f),
    onSuccess: () => { toast.success('Empresa criada!'); onCriado() },
    onError: (e: Error) => toast.error(e.message),
  })

  const valido = f.nomeEmpresa && f.cnpj.length >= 14 && f.razaoSocial && f.nomeAdmin && f.email && f.senha.length >= 6

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg2 border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg2">
          <h2 className="font-bold text-sm">Nova Empresa</h2>
          <button onClick={onFechar}><X size={18} className="text-txt3 hover:text-txt" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-xs font-bold text-txt3 uppercase tracking-wider">Dados da empresa</div>
          <Campo label="Nome fantasia" value={f.nomeEmpresa} onChange={v => setF({ ...f, nomeEmpresa: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="CNPJ" value={f.cnpj} onChange={v => setF({ ...f, cnpj: v })} />
            <Campo label="Telefone" value={f.telefone} onChange={v => setF({ ...f, telefone: v })} />
          </div>
          <Campo label="Razão social" value={f.razaoSocial} onChange={v => setF({ ...f, razaoSocial: v })} />

          <div className="text-xs font-bold text-txt3 uppercase tracking-wider pt-2">Login do administrador</div>
          <Campo label="Nome do admin" value={f.nomeAdmin} onChange={v => setF({ ...f, nomeAdmin: v })} />
          <Campo label="Email" value={f.email} onChange={v => setF({ ...f, email: v })} type="email" />
          <Campo label="Senha" value={f.senha} onChange={v => setF({ ...f, senha: v })} type="password" />

          <div className="text-xs font-bold text-txt3 uppercase tracking-wider pt-2">Plano e acessos</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-txt3 block mb-1">Plano</label>
              <select value={f.plano} onChange={e => setF({ ...f, plano: e.target.value })}
                className="w-full bg-bg3 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-rose">
                {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Campo label="Limite de usuários" value={String(f.limiteUsuarios)} type="number"
              onChange={v => setF({ ...f, limiteUsuarios: parseInt(v) || 1 })} />
          </div>

          <div className="space-y-2 pt-1">
            <ToggleLinha label="CRM de clientes" checked={f.permiteCrm} onChange={v => setF({ ...f, permiteCrm: v })} />
            <ToggleLinha label="Disparo de mensagens" checked={f.permiteMensagens} onChange={v => setF({ ...f, permiteMensagens: v })} />
            <ToggleLinha label="Cupom fiscal (NFC-e)" checked={f.permiteCupomFiscal} onChange={v => setF({ ...f, permiteCupomFiscal: v })} />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-bg2">
          <button onClick={onFechar} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-txt2 hover:text-txt transition-colors">Cancelar</button>
          <button onClick={() => criar.mutate()} disabled={!valido || criar.isPending}
            className="flex-[2] py-2.5 bg-rose text-white rounded-xl text-sm font-bold hover:bg-rose/90 disabled:opacity-50 transition-colors">
            {criar.isPending ? 'Criando...' : 'Criar Empresa'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalEditarEmpresa({ empresa, onFechar, onSalvo }: { empresa: Empresa; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({
    ativo: empresa.ativo, plano: empresa.plano, limiteUsuarios: empresa.limiteUsuarios,
    permiteCrm: empresa.permiteCrm, permiteMensagens: empresa.permiteMensagens,
    permiteCupomFiscal: empresa.permiteCupomFiscal,
  })

  const salvar = useMutation({
    mutationFn: () => api.superadmin.editarEmpresa(empresa.id, f),
    onSuccess: () => { toast.success('Empresa atualizada!'); onSalvo() },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg2 border border-border rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-bold text-sm">{empresa.nome}</h2>
            <p className="text-xs text-txt3 mt-0.5">{empresa.cnpj}</p>
          </div>
          <button onClick={onFechar}><X size={18} className="text-txt3 hover:text-txt" /></button>
        </div>

        <div className="p-6 space-y-4">
          <ToggleLinha label="Empresa ativa" checked={f.ativo} onChange={v => setF({ ...f, ativo: v })} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-txt3 block mb-1">Plano</label>
              <select value={f.plano} onChange={e => setF({ ...f, plano: e.target.value })}
                className="w-full bg-bg3 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-rose">
                {PLANOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <Campo label="Limite de usuários" value={String(f.limiteUsuarios)} type="number"
              onChange={v => setF({ ...f, limiteUsuarios: parseInt(v) || 1 })} />
          </div>

          <div className="space-y-2 pt-1 border-t border-border pt-4">
            <ToggleLinha label="CRM de clientes" checked={f.permiteCrm} onChange={v => setF({ ...f, permiteCrm: v })} />
            <ToggleLinha label="Disparo de mensagens" checked={f.permiteMensagens} onChange={v => setF({ ...f, permiteMensagens: v })} />
            <ToggleLinha label="Cupom fiscal (NFC-e)" checked={f.permiteCupomFiscal} onChange={v => setF({ ...f, permiteCupomFiscal: v })} />
          </div>

          <div className="text-xs text-txt3 flex items-center gap-1.5 pt-1">
            <Users size={12} /> {empresa.qtdUsuarios} usuário{empresa.qtdUsuarios !== 1 ? 's' : ''} cadastrado{empresa.qtdUsuarios !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onFechar} className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-txt2 hover:text-txt transition-colors">Cancelar</button>
          <button onClick={() => salvar.mutate()} disabled={salvar.isPending}
            className="flex-[2] py-2.5 bg-rose text-white rounded-xl text-sm font-bold hover:bg-rose/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            <Check size={15} />{salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-txt3 block mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-bg3 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-rose transition-colors" />
    </div>
  )
}

function ToggleLinha({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="w-full flex items-center justify-between py-1.5">
      <span className="text-sm text-txt2">{label}</span>
      {checked ? <ToggleRight size={26} className="text-green" /> : <ToggleLeft size={26} className="text-txt3" />}
    </button>
  )
}
