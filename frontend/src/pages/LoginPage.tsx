import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { useAuth } from '../store/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuth(s => s.setAuth)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  const login = useMutation({
    mutationFn: () => api.auth.login(email, senha),
    onSuccess: (res) => {
      setAuth(res.token, res.user)
      toast.success(`Bem-vinda, ${res.user.nome.split(' ')[0]}!`)
      navigate('/pdv')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !senha) return toast.error('Preencha email e senha')
    login.mutate()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-rose flex items-center justify-center text-2xl">💄</div>
          <div className="text-center">
            <div className="text-xl font-extrabold tracking-tight">Ruah PDV</div>
            <div className="text-xs text-txt3 mt-0.5">Sistema de ponto de venda</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="bg-bg2 border border-border rounded-2xl p-7 space-y-4">
          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Email</label>
            <input
              type="email"
              autoFocus
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-txt3 uppercase tracking-wider block mb-1.5">Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3"
            />
          </div>

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full py-3 bg-rose text-white font-bold text-sm rounded-lg hover:bg-rose/90 disabled:opacity-50 transition-colors mt-2"
          >
            {login.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-txt3 mt-5">
          Sua empresa ainda não tem conta?{' '}
          <a href="/registro" className="text-rose font-semibold hover:underline">Cadastre-se</a>
        </p>
      </div>
    </div>
  )
}
