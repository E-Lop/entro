import { useMemo } from 'react'
import { CheckCircle } from 'lucide-react'
import { DayRow } from './DayRow'
import { Card, CardContent } from '../ui/card'
import type { Food } from '@/lib/foods'
import { getNext7Days, formatDateKey, groupFoodsByDate } from '@/lib/utils'

interface WeekViewProps {
  foods: Food[]
  onEdit: (food: Food) => void
}

/**
 * WeekView - Calendar agenda of foods expiring in the next 7 days.
 * Days stack vertically (one scroll axis); each day is a DayRow with its
 * count and urgency. Constrained width keeps line length readable on desktop.
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
          <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
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
    <div className="mx-auto max-w-2xl divide-y divide-border">
      {next7Days.map(date => {
        const dateKey = formatDateKey(date)
        const foodsForDay = foodsByDate.get(dateKey) || []

        return (
          <DayRow
            key={dateKey}
            date={date}
            foods={foodsForDay}
            onEdit={onEdit}
          />
        )
      })}
    </div>
  )
}
