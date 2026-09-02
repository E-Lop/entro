import type { QuantityUnit } from '@/types/food.types'
import { unitLabel } from '@/lib/unitLabels'

/**
 * Quantity helpers for the quick-quantity editor (swipe → destra sulle food card).
 *
 * Il DB (`foods.quantity`) è `DECIMAL(10,2)` con `CHECK (quantity > 0)`; lo Zod schema
 * usa `min(0)` (più permissivo). Questi helper colmano il divario lato client: lo
 * stepper non può mai scendere a 0 o sotto lo step minimo, e i valori sono arrotondati
 * a 2 decimali (come la colonna) per evitare la deriva dei float (0.1+0.1+0.1).
 */

// Step "da cucina" per unità: unità intere di 1, peso/volume con incrementi sensati.
const STEP_BY_UNIT: Record<QuantityUnit, number> = {
  pz: 1,
  confezioni: 1,
  kg: 0.1,
  l: 0.1,
  g: 10,
  ml: 10,
}

const INTEGER_UNITS: ReadonlySet<QuantityUnit> = new Set<QuantityUnit>(['pz', 'confezioni'])

/**
 * L'editor rapido non cambia mai l'unità; quando un alimento non ne ha una la
 * trattiamo come pezzi, così lo stepper si comporta in modo prevedibile.
 */
export const DEFAULT_QUANTITY_UNIT: QuantityUnit = 'pz'

/** Arrotonda a 2 decimali, la precisione della colonna DB. */
const round2 = (n: number): number => Math.round(n * 100) / 100

export function stepForUnit(unit: QuantityUnit | null | undefined): number {
  return STEP_BY_UNIT[unit ?? DEFAULT_QUANTITY_UNIT]
}

export function isIntegerUnit(unit: QuantityUnit | null | undefined): boolean {
  return INTEGER_UNITS.has(unit ?? DEFAULT_QUANTITY_UNIT)
}

/** Valore minimo consentito dallo stepper: uno step (il DB richiede `> 0`). */
export function minForUnit(unit: QuantityUnit | null | undefined): number {
  return stepForUnit(unit)
}

/**
 * Sanifica un valore (tipicamente da input digitato) in una quantità valida:
 * mai `null`, mai sotto il minimo, arrotondata alla precisione DB.
 */
export function clampQuantity(value: number | null | undefined, unit: QuantityUnit | null | undefined): number {
  const min = minForUnit(unit)
  if (value == null || Number.isNaN(value) || value < min) return min
  return round2(value)
}

/** `+`: da `null` parte dal minimo (primo tap imposta 1 pz); altrimenti +1 step. */
export function incrementQuantity(value: number | null | undefined, unit: QuantityUnit | null | undefined): number {
  if (value == null) return minForUnit(unit)
  return round2(value + stepForUnit(unit))
}

/** `−` è consentito solo se il risultato resta ≥ minimo (safeguard: mai 0 o sotto). */
export function canDecrement(value: number | null | undefined, unit: QuantityUnit | null | undefined): boolean {
  if (value == null) return false
  return round2(value - stepForUnit(unit)) >= minForUnit(unit)
}

/** `−`: uno step in meno se consentito, altrimenti lascia il valore invariato. */
export function decrementQuantity(
  value: number | null | undefined,
  unit: QuantityUnit | null | undefined,
): number | null {
  if (value == null) return null
  if (!canDecrement(value, unit)) return value
  return round2(value - stepForUnit(unit))
}

/**
 * Resa testuale "valore unità" (es. "1 confezione", "2 confezioni"); `—`
 * quando la quantità manca.
 *
 * L'unità non si compone più col valore che arriva dal database: quello è il
 * vocabolario (`confezioni`, già plurale), e concatenarlo dava «1 confezioni»
 * (entro-mobile#43). La forma da leggere la decide `unitLabel`, cioè la tabella
 * del bundle, perché è **dominio**: se la decidessero i due client,
 * divergerebbero.
 */
export function formatQuantity(value: number | null | undefined, unit: QuantityUnit | null | undefined): string {
  if (value == null) return '—'
  return `${value} ${unitLabel(value, unit ?? DEFAULT_QUANTITY_UNIT)}`
}
