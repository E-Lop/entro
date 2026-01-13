import { Card, CardContent } from '../ui/card'
import type { Food } from '@/lib/foods'

interface CalendarFoodCardProps {
  food: Food
  onEdit: (food: Food) => void
}

/**
 * CalendarFoodCard - Ultra-compact card for calendar view
 * Shows only food name and quantity for maximum density
 */
export function CalendarFoodCard({ food, onEdit }: CalendarFoodCardProps) {
  return (
    <Card
      onClick={() => onEdit(food)}
      className="cursor-pointer hover:bg-slate-50 transition-colors border-slate-200"
    >
      <CardContent className="p-2">
        <p className="text-sm text-slate-900 truncate">
          {food.name}
          {food.quantity && food.quantity_unit && (
            <span className="text-slate-600 ml-1">
              ({food.quantity}{food.quantity_unit})
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  )
}
