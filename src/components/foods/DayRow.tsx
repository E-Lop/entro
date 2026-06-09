import { format, isToday, isTomorrow } from 'date-fns'
import { it } from 'date-fns/locale'
import { CalendarFoodCard } from './CalendarFoodCard'
import type { Food } from '@/lib/foods'
import { cn } from '@/lib/utils'

interface DayRowProps {
  date: Date
  foods: Food[]
  onEdit: (food: Food) => void
}

/** Human label for the day: "Oggi" / "Domani" for the first two days, weekday otherwise. */
function dayLabel(date: Date): string {
  if (isToday(date)) return 'Oggi'
  if (isTomorrow(date)) return 'Domani'
  return format(date, 'EEEE d MMM', { locale: it })
}

/**
 * DayRow - One day section in the calendar agenda.
 * The whole week stacks vertically (single scroll); urgency lives on the day
 * count (today = critical/destructive, other days within the week = warning),
 * never on colour alone (label + count text carry the meaning too).
 */
export function DayRow({ date, foods, onEdit }: DayRowProps) {
  const count = foods.length
  const isEmpty = count === 0
  const isCritical = isToday(date)
  const showRelativeDate = isToday(date) || isTomorrow(date)

  return (
    <section className="py-3">
      <div className="flex items-center justify-between gap-3">
        <h3
          className={cn(
            'text-sm font-medium',
            isEmpty ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {dayLabel(date)}
          {showRelativeDate && (
            <span className="ml-2 font-normal text-muted-foreground">
              {format(date, 'EEE d MMM', { locale: it })}
            </span>
          )}
        </h3>

        {isEmpty ? (
          <span className="text-xs text-muted-foreground">nessuna scadenza</span>
        ) : (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              isCritical ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'
            )}
          >
            {count} {count === 1 ? 'alimento' : 'alimenti'}
          </span>
        )}
      </div>

      {!isEmpty && (
        <div className="mt-2 space-y-2">
          {foods.map(food => (
            <CalendarFoodCard key={food.id} food={food} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  )
}
