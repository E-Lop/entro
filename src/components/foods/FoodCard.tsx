import { differenceInDays, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Calendar, Package, Trash2, Edit, MapPin, ImageIcon, Loader2 } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import type { Food, Category } from '@/lib/foods'
import { cn } from '@/lib/utils'
import { useSignedUrl } from '@/hooks/useSignedUrl'

interface FoodCardProps {
  food: Food
  category?: Category
  onEdit?: (food: Food) => void
  onDelete?: (food: Food) => void
}

/**
 * Get expiry status and color based on days until expiry
 * FIX: Normalize dates to midnight to avoid time-of-day issues
 */
function getExpiryStatus(expiryDate: string) {
  // Normalize both dates to midnight to get accurate calendar day difference
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)

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

  // Generate signed URL for private image
  const { signedUrl, isLoading: imageLoading, error: imageError } = useSignedUrl(food.image_url)

  return (
    <Card className={cn('hover:shadow-md transition-shadow', daysUntilExpiry <= 3 && 'border-orange-300')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-slate-900 line-clamp-2">
              {food.name}
              {food.quantity && (
                <span className="font-normal text-slate-600 ml-1">
                  ({food.quantity} {food.quantity_unit || 'pz'})
                </span>
              )}
            </CardTitle>
          </div>
          <div className={cn('px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap', colorClasses)}>
            {badgeText}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-2">
        {/* Food Image */}
        {food.image_url ? (
          <div className="w-full h-40 rounded-lg overflow-hidden bg-slate-50 mb-3 relative">
            {imageLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
            ) : imageError || !signedUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <ImageIcon className="w-12 h-12 mb-2" />
                <span className="text-xs">Errore caricamento</span>
              </div>
            ) : (
              <img
                src={signedUrl}
                alt={food.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        ) : (
          <div className="w-full h-40 rounded-lg bg-slate-50 flex items-center justify-center mb-3 border-2 border-dashed border-slate-200">
            <ImageIcon className="w-12 h-12 text-slate-300" />
          </div>
        )}

        {/* Category + Storage Location (same row with space between) */}
        <div className="flex items-center justify-between text-sm text-slate-600">
          {category && (
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4 text-slate-400" />
              <span>{category.name_it}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span>{getStorageLabel(food.storage_location)}</span>
          </div>
        </div>

        {/* Expiry Date */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>Scadenza: {formattedExpiryDate}</span>
        </div>

        {/* Notes - Highlighted as user content */}
        {food.notes && (
          <div className="text-sm text-slate-700 line-clamp-2 mt-2 bg-amber-50 rounded-md px-3 py-2">
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
