/**
 * UI theme registry. The active theme is `data-theme` on <html>; globals.css
 * rebinds its tokens under `[data-theme="..."]`. Default carries no overrides,
 * so its tokens are the plain `:root` ones.
 */
export const THEMES = [
  { id: 'default', label: 'Default' },
  { id: 'macos8', label: 'MacOS8' },
  { id: 'liquid-glass', label: 'Liquid Glass' },
  { id: 'paper', label: 'Paper' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'default'

export const THEME_STORAGE_KEY = 'flowgauge-theme'

export function parseTheme(raw: string | null | undefined): ThemeId {
  return THEMES.find((t) => t.id === raw)?.id ?? DEFAULT_THEME
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable; the theme still applies for this visit.
  }
}

/**
 * Light/dark for Liquid Glass only. Stored as `data-mode` on <html>; CSS keys the
 * dark remap on `[data-theme="liquid-glass"][data-mode="dark"]`, so the attribute
 * is inert under other themes and the choice survives a round trip through them.
 */
export const GLASS_MODES = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const

export type GlassMode = (typeof GLASS_MODES)[number]['id']

export const DEFAULT_GLASS_MODE: GlassMode = 'light'

export const GLASS_MODE_STORAGE_KEY = 'flowgauge-glass-mode'

export function parseGlassMode(raw: string | null | undefined): GlassMode {
  return GLASS_MODES.find((m) => m.id === raw)?.id ?? DEFAULT_GLASS_MODE
}

export function applyGlassMode(mode: GlassMode): void {
  document.documentElement.dataset.mode = mode
  try {
    localStorage.setItem(GLASS_MODE_STORAGE_KEY, mode)
  } catch {
    // Storage unavailable; the mode still applies for this visit.
  }
}

/**
 * Puts back the stored theme and glass mode on <html> without writing storage,
 * for previews (the guided tour) that swap the attributes directly. Storage is
 * the user's choice, so a pick made mid-preview through the theme control wins.
 */
export function restoreStoredTheme(): void {
  const root = document.documentElement
  try {
    root.dataset.theme = parseTheme(localStorage.getItem(THEME_STORAGE_KEY))
    root.dataset.mode = parseGlassMode(localStorage.getItem(GLASS_MODE_STORAGE_KEY))
  } catch {
    root.dataset.theme = DEFAULT_THEME
    root.dataset.mode = DEFAULT_GLASS_MODE
  }
}

/**
 * Runs in <head> before first paint so a stored theme (and glass mode) never
 * flashes Default.
 * Inlined as a string because it must execute before React hydrates.
 *
 * Also flags Chromium (the only engine with navigator.userAgentData, and the only
 * one that accepts an SVG filter in backdrop-filter) so Liquid Glass can add its
 * lens warp there without breaking the frosted fallback elsewhere.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(${JSON.stringify(
  THEMES.map((t) => t.id)
)}.indexOf(t)>-1)document.documentElement.dataset.theme=t;var m=localStorage.getItem('${GLASS_MODE_STORAGE_KEY}');if(${JSON.stringify(
  GLASS_MODES.map((m) => m.id)
)}.indexOf(m)>-1)document.documentElement.dataset.mode=m;if(navigator.userAgentData)document.documentElement.dataset.glassRefract=''}catch(e){}`
