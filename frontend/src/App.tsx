import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/shared/Layout'
import { PDVPage } from './pages/PDVPage'
import { EstoquePage } from './pages/EstoquePage'
import { CaixaPage } from './pages/CaixaPage'
import { ClientesPage } from './pages/ClientesPage'
import { RelatoriosPage } from './pages/RelatoriosPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/pdv" replace />} />
        <Route path="/pdv" element={<PDVPage />} />
        <Route path="/estoque" element={<EstoquePage />} />
        <Route path="/caixa" element={<CaixaPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
      </Route>
    </Routes>
  )
}
