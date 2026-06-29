import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/pdv',       label: '🛒 PDV'         },
  { to: '/caixa',     label: '💰 Caixa'        },
  { to: '/estoque',   label: '📦 Estoque'      },
  { to: '/clientes',  label: '👥 Clientes'     },
  { to: '/relatorios',label: '📊 Relatórios'   },
]

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-bg/95 backdrop-blur border-b border-border flex items-center px-6 gap-2">
        <div className="flex items-center gap-2 mr-6">
          <div className="w-2 h-2 rounded-full bg-rose" />
          <span className="font-extrabold text-sm tracking-tight">Ruah PDV</span>
        </div>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `text-xs font-semibold px-3 py-1.5 rounded-md border transition-all ${
                isActive
                  ? 'bg-rose text-white border-rose'
                  : 'text-txt2 border-border hover:text-txt hover:bg-bg3'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-txt3">
          <div className="w-1.5 h-1.5 rounded-full bg-green" />
          Bella Makeup Store
        </div>
      </nav>

      {/* Content */}
      <main className="pt-14 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
