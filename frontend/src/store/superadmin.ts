import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SuperAdminUser {
  nome: string
  email: string
}

interface SuperAdminState {
  token: string | null
  admin: SuperAdminUser | null
  setAuth: (token: string, admin: SuperAdminUser) => void
  logout: () => void
}

export const useSuperAdmin = create<SuperAdminState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      setAuth: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
    }),
    { name: 'ruah-superadmin-auth' }
  )
)
