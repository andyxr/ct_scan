'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

export type Skin = 'original' | 'macos8'

export const SKINS = [
  { id: 'original', label: 'Original' },
  { id: 'macos8', label: 'Mac OS 8' },
] as const satisfies ReadonlyArray<{ id: Skin; label: string }>

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  skin: Skin
  setSkin: (skin: Skin) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Every launch starts in Mac OS 8 light; app/layout.tsx puts the same
  // classes on <html> so the first paint matches this state.
  const [theme, setTheme] = useState<Theme>('light')
  const [skin, setSkin] = useState<Skin>('macos8')

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('macos8', skin === 'macos8')
  }, [skin])

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, skin, setSkin }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
