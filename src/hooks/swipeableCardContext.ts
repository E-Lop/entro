// Contesto e hook vivono fuori dal file del provider: un modulo che esporta
// insieme un componente e valori non ricaricabili a caldo fa perdere lo stato
// a ogni salvataggio (`react-refresh/only-export-components`).
import { createContext } from 'react'

export interface SwipeableCardControllerValue {
  openId: string | null
  open: (id: string) => void
  close: () => void
}

export const SwipeableCardContext = createContext<SwipeableCardControllerValue | null>(null)
