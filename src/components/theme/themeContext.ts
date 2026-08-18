// Il contesto sta qui e non in `ThemeProvider.tsx`: un modulo che esporta sia
// il provider sia il contesto non è ricaricabile a caldo, e Fast Refresh
// rimonta l'albero perdendo lo stato (`react-refresh/only-export-components`).
import { createContext } from 'react'

export type Theme = 'light' | 'dark' | 'system'

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  effectiveTheme: 'light' | 'dark'
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
