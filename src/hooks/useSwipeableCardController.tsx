import { useCallback, useEffect, useState } from 'react'
import { SwipeableCardContext } from './swipeableCardContext'

/**
 * Coordina le card apribili (editor rapido di quantità) di una lista:
 * - **una sola aperta per volta** (aprirne un'altra chiude la precedente);
 * - **chiusura allo scroll verticale** della lista.
 *
 * Il listener di scroll usa `capture: true` su `window`, così intercetta lo scroll
 * di qualsiasi contenitore annidato senza bisogno di passare un ref.
 */
export function SwipeableCardProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)

  const open = useCallback((id: string) => setOpenId(id), [])
  // React salta il re-render se lo stato non cambia (Object.is(null, null)), quindi
  // chiudere quando è già chiuso è a costo zero: nessun guard sul valore precedente.
  const close = useCallback(() => setOpenId(null), [])

  useEffect(() => {
    if (openId == null) return
    const handler = () => close()
    const opts: AddEventListenerOptions = { capture: true, passive: true }
    window.addEventListener('scroll', handler, opts)
    return () => window.removeEventListener('scroll', handler, opts)
  }, [openId, close])

  return (
    <SwipeableCardContext.Provider value={{ openId, open, close }}>
      {children}
    </SwipeableCardContext.Provider>
  )
}
