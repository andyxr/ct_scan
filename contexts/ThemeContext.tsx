'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // Check for saved theme preference or default to system preference
    const savedTheme = localStorage.getItem('theme') as Theme
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    if (savedTheme) {
      setTheme(savedTheme)
      // Apply immediately on mount
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(savedTheme)
    } else if (systemPrefersDark) {
      setTheme('dark')
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add('dark')
    } else {
      // Explicitly set light mode
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add('light')
    }
  }, [])

  useEffect(() => {
    // Apply theme to document root
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)

    // Save theme preference
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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