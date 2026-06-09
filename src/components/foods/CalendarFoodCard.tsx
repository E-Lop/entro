import type { Food } from '@/lib/foods'

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
  const label = hasQuantity
    ? `Modifica ${food.name}, ${food.quantity}${food.quantity_unit}`
    : `Modifica ${food.name}`

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
          <span className="ml-1 text-muted-foreground">
            ({food.quantity}{food.quantity_unit})
          </span>
        )}
      </span>
    </button>
  )
}
