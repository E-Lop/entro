import { differenceInDays, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Calendar, Package, Trash2, Edit, MapPin } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import type { Food, Category } from '@/lib/foods'
import { cn } from '@/lib/utils'

interface FoodCardProps {
  food: Food
  category?: Category
  onEdit?: (food: Food) => void
  onDelete?: (food: Food) => void
}

/**
 * Get expiry status and color based on days until expiry
 */
function getExpiryStatus(expiryDate: string) {
  const now = new Date()
  const expiry = new Date(expiryDate)
  const daysUntilExpiry = differenceInDays(expiry, now)

  let status: 'expired' | 'critical' | 'warning' | 'good'
  let colorClasses: string
  let badgeText: string

  if (daysUntilExpiry < 0) {
    status = 'expired'
    colorClasses = 'bg-red-100 text-red-800 border-red-200'
    badgeText = 'Scaduto'
  } else if (daysUntilExpiry === 0) {
    status = 'critical'
    colorClasses = 'bg-red-100 text-red-800 border-red-200'
    badgeText = 'Scade oggi'
  } else if (daysUntilExpiry <= 3) {
    status = 'critical'
    colorClasses = 'bg-orange-100 text-orange-800 border-orange-200'
    badgeText = `${daysUntilExpiry} giorni`
  } else if (daysUntilExpiry <= 7) {
    status = 'warning'
    colorClasses = 'bg-yellow-100 text-yellow-800 border-yellow-200'
    badgeText = `${daysUntilExpiry} giorni`
  } else {
    status = 'good'
    colorClasses = 'bg-green-100 text-green-800 border-green-200'
    badgeText = `${daysUntilExpiry} giorni`
  }

  return { status, colorClasses, badgeText, daysUntilExpiry }
}

/**
 * Get storage location label in Italian
 */
function getStorageLabel(location: Food['storage_location']): string {
  const labels: Record<Food['storage_location'], string> = {
    fridge: 'Frigo',
    freezer: 'Freezer',
    pantry: 'Dispensa',
  }
  return labels[location]
}

/**
 * FoodCard Component - Displays a single food item with expiry status
 */
export function FoodCard({ food, category, onEdit, onDelete }: FoodCardProps) {
  const { colorClasses, badgeText, daysUntilExpiry } = getExpiryStatus(food.expiry_date)
  const formattedExpiryDate = format(new Date(food.expiry_date), 'dd MMM yyyy', { locale: it })

  return (
    <Card className={cn('hover:shadow-md transition-shadow', daysUntilExpiry <= 3 && 'border-orange-300')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-slate-900 line-clamp-2">
            {food.name}
          </CardTitle>
          <div className={cn('px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap', colorClasses)}>
            {badgeText}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-2">
        {/* Category */}
        {category && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Package className="h-4 w-4 text-slate-400" />
            <span>{category.name_it}</span>
          </div>
        )}

        {/* Storage Location */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin className="h-4 w-4 text-slate-400" />
          <span>{getStorageLabel(food.storage_location)}</span>
        </div>

        {/* Expiry Date */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>Scadenza: {formattedExpiryDate}</span>
        </div>

        {/* Quantity */}
        {food.quantity && (
          <div className="text-sm text-slate-600">
            Quantità: {food.quantity} {food.quantity_unit || ''}
          </div>
        )}

        {/* Notes */}
        {food.notes && (
          <div className="text-sm text-slate-500 line-clamp-2 mt-2">
            {food.notes}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-2">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(food)}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-2" />
            Modifica
          </Button>
        )}
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(food)}
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Elimina
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
