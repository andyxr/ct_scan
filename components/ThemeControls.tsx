'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { SKINS, useTheme, type Skin } from '@/contexts/ThemeContext'

export default function ThemeControls() {
  const { theme, toggleTheme, skin, setSkin } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      className="flex items-center gap-3 z-50"
      style={{
        position: 'fixed',
        top: '2rem',
        right: '2rem',
      }}
    >
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        Theme
        <select
          value={skin}
          onChange={event => setSkin(event.target.value as Skin)}
          className="px-2 py-1 text-sm rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
        >
          {SKINS.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={toggleTheme}
        className="w-10 h-10 rounded-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 flex items-center justify-center"
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
    </div>
  )
}
