'use client'

import { useSyncExternalStore } from 'react'
import { DEFAULT_THEME, THEMES, applyTheme, parseTheme } from '@/lib/theme'

// <html data-theme> is the single source of truth: the boot script sets it before
// hydration and applyTheme changes it, so the select just observes the attribute.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

const readTheme = () => parseTheme(document.documentElement.dataset.theme)

export default function ThemeSelect() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME)

  return (
    <label className="sheet-field flex items-baseline gap-1.5 px-2 py-1">
      <span className="opacity-70">Theme</span>
      <select
        value={theme}
        onChange={(e) => applyTheme(parseTheme(e.target.value))}
        className="theme-select cursor-pointer bg-transparent font-bold uppercase outline-none"
        aria-label="Choose UI theme"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  )
}
