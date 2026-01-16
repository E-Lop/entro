import { useMemo } from 'react'
import { CheckCircle } from 'lucide-react'
import { DayColumn } from './DayColumn'
import { Card, CardContent } from '../ui/card'
import type { Food } from '@/lib/foods'
import { getNext7Days, formatDateKey, groupFoodsByDate } from '@/lib/utils'

interface WeekViewProps {
  foods: Food[]
  onEdit: (food: Food) => void
}

/**
 * WeekView - Calendar view showing foods expiring in the next 7 days
 * Organized by day with horizontal scroll on mobile, grid on desktop
 */
export function WeekView({ foods, onEdit }: WeekViewProps) {
  // Filter foods to 7-day window (today + 6 days)
  const filteredFoods = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(today.getDate() + 6)

    return foods.filter(food => {
      const expiryDate = new Date(food.expiry_date)
      expiryDate.setHours(0, 0, 0, 0)

      return expiryDate >= today && expiryDate <= sevenDaysFromNow
    })
  }, [foods])

  // Group foods by expiry date
  const foodsByDate = useMemo(() => {
    return groupFoodsByDate(filteredFoods)
  }, [filteredFoods])

  // Generate 7-day date range
  const next7Days = useMemo(() => getNext7Days(), [])

  // Empty state when no foods in 7 days
  if (filteredFoods.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Ottimo! Nessun alimento in scadenza
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Non ci sono alimenti che scadono nei prossimi 7 giorni.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {/* Week Grid Container */}
      <div className="grid grid-flow-col auto-cols-[280px] sm:grid-cols-7 sm:auto-cols-fr gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory px-1 sm:px-0 pb-4 sm:pb-0">
        {next7Days.map(date => {
          const dateKey = formatDateKey(date)
          const foodsForDay = foodsByDate.get(dateKey) || []

          return (
            <div key={dateKey} className="snap-start">
              <DayColumn
                date={date}
                foods={foodsForDay}
                onEdit={onEdit}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
