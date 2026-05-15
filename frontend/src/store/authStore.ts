import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '../types'

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
  canOrder: () => boolean
  canPrepare: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      clearAuth: () => set({ accessToken: null, user: null }),
      isAuthenticated: () => !!get().accessToken && !!get().user,
      isAdmin: () => get().user?.role === 'admin',
      canOrder: () => !!(get().user?.canOrder) || get().user?.role === 'admin',
      canPrepare: () => !!(get().user?.canPrepare) || get().user?.role === 'admin',
    }),
    {
      name: 'kahma-auth',
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    },
  ),
)
