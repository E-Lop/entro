import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'entro-theme'

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

    // Determine effective theme
    let effectiveTheme: 'light' | 'dark' = 'light'

    if (theme === 'system') {
      // Use system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      effectiveTheme = systemPrefersDark ? 'dark' : 'light'
    } else {
      effectiveTheme = theme
    }

    // Apply theme class
    root.classList.add(effectiveTheme)

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
    effectiveTheme: theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme,
  }
}
