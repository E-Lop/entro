import { useState, useRef, useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '@/lib/utils'
import type { QuantityUnit } from '@/types/food.types'
import {
  stepForUnit,
  canDecrement,
  incrementQuantity,
  decrementQuantity,
  clampQuantity,
  formatQuantity,
  DEFAULT_QUANTITY_UNIT,
} from '@/lib/quantity'
import { unitLabel } from '@/lib/unitLabels'

interface QuantityStepperProps {
  value: number | null
  unit: QuantityUnit | null
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
}

/**
 * QuantityStepper — controllo orizzontale `−  valore  +` per l'editor rapido.
 *
 * - Target tattili ≥44px (size icon-touch), asse orizzontale coerente con lo swipe.
 * - `−` disabilitato al minimo (mai 0: vedi `@/lib/quantity`).
 * - Tocca il valore per digitare un numero preciso (decimali); blocca `-`/`e`.
 * - Il valore corrente è annunciato agli screen reader (`aria-live`).
 */
export function QuantityStepper({ value, unit, onChange, disabled = false, className }: QuantityStepperProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * L'unità si accorda col numero, e la parola esce dalla tabella del bundle.
   *
   * Lo stepper impila numero e unità in due `span`, quindi non passa da
   * `formatQuantity` ed era rimasto fuori dalla v1.11.14: a schermo restava «1
   * / confezioni». Stesso punto scoperto anche sul client nativo
   * (entro-mobile#43), e corretto nella stessa passata.
   */
  const displayUnit = unitLabel(value, unit ?? DEFAULT_QUANTITY_UNIT)
  const decrementAllowed = !disabled && canDecrement(value, unit)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const commitDraft = () => {
    const parsed = parseFloat(draft.replace(',', '.'))
    onChange(clampQuantity(Number.isNaN(parsed) ? value : parsed, unit))
    setIsEditing(false)
  }

  return (
    <div
      role="group"
      aria-label="Quantità"
      className={cn('flex items-center justify-center gap-4', className)}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-touch"
        aria-label="Diminuisci quantità"
        disabled={!decrementAllowed}
        onClick={() => {
          const next = decrementQuantity(value, unit)
          if (next != null) onChange(next)
        }}
      >
        <Minus className="h-5 w-5" aria-hidden="true" />
      </Button>

      {isEditing ? (
        <Input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          step={stepForUnit(unit)}
          min={0}
          value={draft}
          aria-label="Quantità"
          className="h-11 w-24 text-center text-xl font-semibold tabular-nums"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault()
            if (e.key === 'Enter') commitDraft()
            if (e.key === 'Escape') setIsEditing(false)
          }}
          onBlur={commitDraft}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          aria-label={`Quantità: ${formatQuantity(value, unit)}. Tocca per modificare`}
          className="min-w-24 rounded-md px-2 py-1 text-center leading-tight focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          onClick={() => {
            setDraft(value == null ? '' : String(value))
            setIsEditing(true)
          }}
        >
          <span aria-live="polite" className="block text-2xl font-semibold tabular-nums text-foreground">
            {value == null ? '—' : value}
          </span>
          <span className="block text-xs text-muted-foreground">{displayUnit}</span>
        </button>
      )}

      <Button
        type="button"
        variant="outline"
        size="icon-touch"
        aria-label="Aumenta quantità"
        disabled={disabled}
        onClick={() => onChange(incrementQuantity(value, unit))}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  )
}
