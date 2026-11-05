'use client'

import { useSyncExternalStore } from 'react'
import {
  DEFAULT_GLASS_MODE,
  DEFAULT_THEME,
  GLASS_MODES,
  THEMES,
  applyGlassMode,
  applyTheme,
  parseGlassMode,
  parseTheme,
} from '@/lib/theme'

// <html data-theme / data-mode> are the single source of truth: the boot script
// sets them before hydration and applyTheme / applyGlassMode change them, so the
// controls just observe the attributes.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] })
  return () => observer.disconnect()
}

const readTheme = () => parseTheme(document.documentElement.dataset.theme)
const readGlassMode = () => parseGlassMode(document.documentElement.dataset.mode)

export default function ThemeSelect() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME)
  const mode = useSyncExternalStore(subscribe, readGlassMode, () => DEFAULT_GLASS_MODE)

  return (
    <>
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
      {theme === 'liquid-glass' && (
        <div role="radiogroup" aria-label="Appearance" className="sheet-field mode-switch flex items-center gap-0.5 p-0.5">
          {GLASS_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => applyGlassMode(m.id)}
              className="mode-switch-option cursor-pointer px-2 py-0.5 font-bold"
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
