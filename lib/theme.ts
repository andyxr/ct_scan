/**
 * UI theme registry. The active theme is `data-theme` on <html>; globals.css
 * rebinds its tokens under `[data-theme="..."]`. Default carries no overrides,
 * so its tokens are the plain `:root` ones.
 */
export const THEMES = [
  { id: 'default', label: 'Default' },
  { id: 'macos8', label: 'MacOS8' },
  { id: 'liquid-glass', label: 'Liquid Glass' },
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
 * Runs in <head> before first paint so a stored theme never flashes Default.
 * Inlined as a string because it must execute before React hydrates.
 *
 * Also flags Chromium (the only engine with navigator.userAgentData, and the only
 * one that accepts an SVG filter in backdrop-filter) so Liquid Glass can add its
 * lens warp there without breaking the frosted fallback elsewhere.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(${JSON.stringify(
  THEMES.map((t) => t.id)
)}.indexOf(t)>-1)document.documentElement.dataset.theme=t;if(navigator.userAgentData)document.documentElement.dataset.glassRefract=''}catch(e){}`
