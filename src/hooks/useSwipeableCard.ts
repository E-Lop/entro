import { useContext, useState } from 'react'
import { SwipeableCardContext } from './swipeableCardContext'

/**
 * Stato apertura di una singola card. Se usata fuori da `SwipeableCardProvider`
 * (es. `InstructionCard`) ricade su uno stato locale, senza coordinamento globale.
 */
export function useSwipeableCard(id: string) {
  const ctx = useContext(SwipeableCardContext)
  const [localOpen, setLocalOpen] = useState(false)

  if (!ctx) {
    return {
      isOpen: localOpen,
      open: () => setLocalOpen(true),
      close: () => setLocalOpen(false),
    }
  }

  return {
    isOpen: ctx.openId === id,
    open: () => ctx.open(id),
    close: ctx.close,
  }
}
