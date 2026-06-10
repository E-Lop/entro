import { createContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'entro-theme'

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  effectiveTheme: 'light' | 'dark'
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Resolve the effective light/dark value from the user preference.
 */
function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

/**
 * Swap the `light`/`dark` class on <html> to match the effective theme.
 */
function applyThemeClass(effective: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(effective)
}

/**
 * Applies the active theme to <html> for the whole app, on every route.
 *
 * Mounted at the root (above the router) so public routes (login, legali, ...)
 * honour the user's theme too -- previously the class was only applied inside
 * AppLayout, leaving unauthenticated pages stuck in light mode.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    return stored || 'system'
  })

  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() =>
    getEffectiveTheme(theme)
  )

  useEffect(() => {
    const effective = getEffectiveTheme(theme)
    applyThemeClass(effective)
    setEffectiveTheme(effective)

    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  // Follow the OS preference live while on 'system'.
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      const effective = mediaQuery.matches ? 'dark' : 'light'
      applyThemeClass(effective)
      setEffectiveTheme(effective)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
