'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export default function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Always render button, but show loading state until mounted
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        console.log('Dark mode toggle clicked, current theme:', theme)
        toggleTheme()
      }}
      className="w-10 h-10 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 z-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 flex items-center justify-center"
      style={{
        position: 'fixed',
        top: '2rem',
        right: '2rem',
      }}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      type="button"
    >
      {!mounted ? (
        <div className="w-5 h-5 bg-gray-300 rounded-full animate-pulse"></div>
      ) : theme === 'light' ? (
        <Moon className="w-5 h-5 text-gray-700" />
      ) : (
        <Sun className="w-5 h-5 text-yellow-500" />
      )}
    </button>
  )
}