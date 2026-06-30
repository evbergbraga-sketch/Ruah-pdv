import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../lib/api'

export function RegistroPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nomeEmpresa: '', cnpj: '', razaoSocial: '', telefone: '',
    nomeAdmin: '', email: '', senha: '',
  })

  const registro = useMutation({
    mutationFn: () => api.auth.registro(form),
    onSuccess: () => {
      toast.success('Empresa cadastrada! Faça login para continuar.')
      navigate('/login')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (Object.values(form).filter((v, i) => i !== 3).some(v => !v.trim())) {
      return toast.error('Preencha todos os campos obrigatórios')
    }
    if (form.senha.length < 6) return toast.error('Senha deve ter no mínimo 6 caracteres')
    registro.mutate()
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-7">
          <div className="w-12 h-12 rounded-2xl bg-rose flex items-center justify-center text-2xl">💄</div>
          <div className="text-center">
            <div className="text-xl font-extrabold tracking-tight">Criar sua conta</div>
            <div className="text-xs text-txt3 mt-0.5">Comece a vender em minutos</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="bg-bg2 border border-border rounded-2xl p-7 space-y-4">
          <div className="text-xs font-bold text-txt3 uppercase tracking-wider">Dados da Empresa</div>

          <div>
            <label className="text-xs text-txt3 block mb-1.5">Nome da loja *</label>
            <input value={form.nomeEmpresa} onChange={set('nomeEmpresa')} placeholder="Bella Makeup Store"
              className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-txt3 block mb-1.5">CNPJ *</label>
              <input value={form.cnpj} onChange={set('cnpj')} placeholder="00.000.000/0001-00"
                className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3" />
            </div>
            <div>
              <label className="text-xs text-txt3 block mb-1.5">Telefone</label>
              <input value={form.telefone} onChange={set('telefone')} placeholder="(11) 99999-9999"
                className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3" />
            </div>
          </div>

          <div>
            <label className="text-xs text-txt3 block mb-1.5">Razão social *</label>
            <input value={form.razaoSocial} onChange={set('razaoSocial')} placeholder="Bella Makeup Store Ltda"
              className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3" />
          </div>

          <div className="text-xs font-bold text-txt3 uppercase tracking-wider pt-2">Seu Acesso (administrador)</div>

          <div>
            <label className="text-xs text-txt3 block mb-1.5">Seu nome *</label>
            <input value={form.nomeAdmin} onChange={set('nomeAdmin')} placeholder="Maria Silva"
              className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3" />
          </div>

          <div>
            <label className="text-xs text-txt3 block mb-1.5">Email *</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="seu@email.com"
              className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3" />
          </div>

          <div>
            <label className="text-xs text-txt3 block mb-1.5">Senha *</label>
            <input type="password" value={form.senha} onChange={set('senha')} placeholder="Mínimo 6 caracteres"
              className="w-full bg-bg3 border border-border rounded-lg px-4 py-2.5 text-sm text-txt outline-none focus:border-rose transition-colors placeholder:text-txt3" />
          </div>

          <button type="submit" disabled={registro.isPending}
            className="w-full py-3 bg-rose text-white font-bold text-sm rounded-lg hover:bg-rose/90 disabled:opacity-50 transition-colors mt-2">
            {registro.isPending ? 'Criando conta...' : 'Criar minha conta'}
          </button>
        </form>

        <p className="text-center text-xs text-txt3 mt-5">
          Já tem uma conta?{' '}
          <a href="/login" className="text-rose font-semibold hover:underline">Entrar</a>
        </p>
      </div>
    </div>
  )
}
