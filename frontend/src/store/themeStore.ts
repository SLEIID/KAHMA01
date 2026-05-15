import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggle: () => void
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      toggle: () => {
        const next: Theme = get().theme === 'light' ? 'dark' : 'light'
        set({ theme: next })
        applyTheme(next)
      },
    }),
    { name: 'kahma-theme' },
  ),
)

export function initTheme() {
  const stored = localStorage.getItem('kahma-theme')
  const theme: Theme = stored
    ? (JSON.parse(stored)?.state?.theme ?? 'light')
    : 'light'
  applyTheme(theme)
}
