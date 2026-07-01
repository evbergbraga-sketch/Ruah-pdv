import { Navigate, Outlet } from 'react-router-dom'
import { useSuperAdmin } from '../../store/superadmin'

export function RequireSuperAdmin() {
  const token = useSuperAdmin(s => s.token)
  if (!token) return <Navigate to="/superadmin/login" replace />
  return <Outlet />
}
