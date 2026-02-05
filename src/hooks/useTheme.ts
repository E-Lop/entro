import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'entro-theme'

/**
 * Get the effective theme based on user preference and system settings
 */
function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

/**
 * Custom hook for managing theme (light/dark/system)
 * - Persists preference to localStorage
 * - Respects system preference when theme is 'system'
 * - Applies 'dark' class to document element
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Initialize from localStorage or default to 'system'
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    return stored || 'system'
  })

  useEffect(() => {
    const root = document.documentElement

    // Remove existing theme classes
    root.classList.remove('light', 'dark')

    // Apply effective theme class
    root.classList.add(getEffectiveTheme(theme))

    // Persist to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  // Listen to system preference changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(mediaQuery.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return {
    theme,
    setTheme,
    effectiveTheme: getEffectiveTheme(theme),
  }
}
