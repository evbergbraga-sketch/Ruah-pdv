import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'
import { useSuperAdmin } from '../../store/superadmin'

export function SuperAdminLoginPage() {
  const navigate = useNavigate()
  const setAuth = useSuperAdmin(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)

  async function entrar() {
    setLoading(true)
    try {
      const res = await api.superadmin.login(email, senha)
      setAuth(res.token, res.admin)
      navigate('/superadmin')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-dim border border-rose flex items-center justify-center">
            <ShieldCheck size={22} className="text-rose" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Painel Master</h1>
          <p className="text-xs text-txt3">Acesso restrito — Ruah Systems</p>
        </div>

        <div className="bg-bg2 border border-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && entrar()}
              className="w-full bg-bg3 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-rose transition-colors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && entrar()}
              className="w-full bg-bg3 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-rose transition-colors" />
          </div>
          <button onClick={entrar} disabled={loading || !email || !senha}
            className="w-full py-3 bg-rose text-white font-bold rounded-xl hover:bg-rose/90 disabled:opacity-50 transition-colors">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
