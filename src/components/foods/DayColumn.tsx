import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { CheckCircle } from 'lucide-react'
import { CalendarFoodCard } from './CalendarFoodCard'
import type { Food } from '@/lib/foods'

interface DayColumnProps {
  date: Date
  foods: Food[]
  onEdit: (food: Food) => void
}

/**
 * DayColumn - Displays foods for a single day in calendar view
 */
export function DayColumn({ date, foods, onEdit }: DayColumnProps) {
  const itemCount = foods.length

  return (
    <div className="flex flex-col h-full min-h-[400px] border border-slate-200 rounded-lg bg-white p-3">
      {/* Day Header (sticky) */}
      <div className="sticky top-0 bg-white pb-2 mb-3 border-b border-slate-200 z-10">
        <div className="text-sm font-medium text-slate-900 mb-1">
          {format(date, 'EEEE dd MMM', { locale: it })}
        </div>
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
          {itemCount} {itemCount === 1 ? 'alimento' : 'alimenti'}
        </span>
      </div>

      {/* Food List or Empty State */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-[600px]">
        {foods.length > 0 ? (
          foods.map(food => (
            <CalendarFoodCard
              key={food.id}
              food={food}
              onEdit={onEdit}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
            <p className="text-xs text-slate-500">Nessuna scadenza</p>
          </div>
        )}
      </div>
    </div>
  )
}
