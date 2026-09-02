import type { Food } from '@/lib/foods'
import { formatQuantity } from '@/lib/quantity'

interface CalendarFoodCardProps {
  food: Food
  onEdit: (food: Food) => void
}

/**
 * CalendarFoodCard - Ultra-compact entry for calendar view.
 * Shows only food name and quantity for maximum density.
 * Rendered as a real <button> so it is operable by keyboard (WCAG 2.1.1).
 */
export function CalendarFoodCard({ food, onEdit }: CalendarFoodCardProps) {
  const hasQuantity = food.quantity && food.quantity_unit
  // Come sulla card grande, la quantità la compone `formatQuantity`: qui la
  // concatenazione a mano non solo non accordava l'unità («1confezioni»), la
  // attaccava anche al numero — e questa stringa è la frase che uno screen
  // reader legge (entro-mobile#43).
  const quantita = formatQuantity(food.quantity, food.quantity_unit)
  const label = hasQuantity ? `Modifica ${food.name}, ${quantita}` : `Modifica ${food.name}`

  return (
    <button
      type="button"
      onClick={() => onEdit(food)}
      aria-label={label}
      className="flex min-h-[44px] w-full items-center rounded-xl border border-border bg-card p-2 text-left text-card-foreground shadow transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="truncate text-sm text-foreground">
        {food.name}
        {hasQuantity && (
          <span className="ml-1 text-muted-foreground">({quantita})</span>
        )}
      </span>
    </button>
  )
}
