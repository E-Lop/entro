import { useContext } from 'react'
import { ThemeContext } from '@/components/theme/ThemeProvider'

/**
 * Read and control the app theme (light/dark/system).
 *
 * The theme is applied to <html> by `ThemeProvider` at the root, so this hook
 * only consumes the shared context -- there is a single source of truth and the
 * class is applied on every route, public ones included.
 */
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
