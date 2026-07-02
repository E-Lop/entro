import { useEffect, useRef, useState } from 'react'
import { Edit } from 'lucide-react'
import { onlineManager } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { QuantityStepper } from './QuantityStepper'
import { useUpdateFood } from '@/hooks/useFoods'
import { triggerHaptic } from '@/lib/haptics'
import type { Food } from '@/lib/foods'
import type { QuantityUnit } from '@/types/food.types'

interface QuickQuantityEditorProps {
  food: Food
  /** Apre la modale di modifica completa (comportamento swipe→destra precedente). */
  onOpenFullEdit: () => void
}

/** Attende l'ultimo tap prima di persistere, per coalescere i tap rapidi su +/−. */
const PERSIST_DEBOUNCE_MS = 600

/**
 * QuickQuantityEditor — faccia "quantità" mostrata quando la card è agganciata aperta.
 *
 * Auto-save ottimistico: ogni tap aggiorna il valore locale e programma la persistenza
 * con debounce; alla chiusura (unmount) la modifica pendente viene subito salvata via
 * `useUpdateFood` (optimistic update + coda offline già gestiti nel hook). Cambia solo
 * il numero; l'unità si modifica in "Modifica completa".
 */
export function QuickQuantityEditor({ food, onOpenFullEdit }: QuickQuantityEditorProps) {
  const updateMutation = useUpdateFood()
  const unit = food.quantity_unit as QuantityUnit | null

  const [value, setValue] = useState<number | null>(food.quantity)
  const pendingRef = useRef<number | null>(food.quantity)
  const lastPersistedRef = useRef<number | null>(food.quantity)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const offlineNotifiedRef = useRef(false)

  const persist = (next: number | null) => {
    if (next == null || next === lastPersistedRef.current) return
    lastPersistedRef.current = next
    updateMutation.mutate({ id: food.id, data: { quantity: next } })
    if (!onlineManager.isOnline() && !offlineNotifiedRef.current) {
      offlineNotifiedRef.current = true
      toast.info('Modifica salvata offline. Verrà sincronizzata quando torni online.')
    }
  }

  const handleChange = (next: number) => {
    setValue(next)
    pendingRef.current = next
    triggerHaptic('nudge')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(next), PERSIST_DEBOUNCE_MS)
  }

  // Flush della modifica pendente alla chiusura della card (l'editor viene smontato).
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
      persist(pendingRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-card px-4 py-3">
      <p className="max-w-full truncate text-sm font-medium text-foreground">{food.name}</p>

      <QuantityStepper value={value} unit={unit} onChange={handleChange} />

      <Button variant="outline" size="sm" className="gap-2" onClick={onOpenFullEdit}>
        <Edit className="h-4 w-4" aria-hidden="true" />
        Modifica completa
      </Button>
    </div>
  )
}
