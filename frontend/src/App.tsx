import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/shared/Layout'
import { RequireAuth } from './components/shared/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { RegistroPage } from './pages/RegistroPage'
import { PDVPage } from './pages/PDVPage'
import { EstoquePage } from './pages/EstoquePage'
import { CaixaPage } from './pages/CaixaPage'
import { ClientesPage } from './pages/ClientesPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { SuperAdminLoginPage } from './pages/superadmin/SuperAdminLoginPage'
import { SuperAdminDashboard } from './pages/superadmin/SuperAdminDashboard'
import { RequireSuperAdmin } from './components/shared/RequireSuperAdmin'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />

      <Route path="/superadmin/login" element={<SuperAdminLoginPage />} />
      <Route element={<RequireSuperAdmin />}>
        <Route path="/superadmin" element={<SuperAdminDashboard />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/pdv" replace />} />
          <Route path="/pdv" element={<PDVPage />} />
          <Route path="/estoque" element={<EstoquePage />} />
          <Route path="/caixa" element={<CaixaPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/relatorios" element={<RelatoriosPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
