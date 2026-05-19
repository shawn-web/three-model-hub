import { create } from 'zustand'

type ThemeMode = 'dark' | 'light'

interface ThemeState {
  mode: ThemeMode
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: (localStorage.getItem('theme') as ThemeMode) || 'dark',
  toggleTheme: () => set((state) => {
    const next = state.mode === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', next)
    return { mode: next }
  }),
}))
