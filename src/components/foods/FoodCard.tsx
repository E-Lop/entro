import { differenceInDays, format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Calendar, Package, Trash2, Edit, MapPin, ImageIcon, Loader2 } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import type { Food, Category } from '@/lib/foods'
import type { FoodWithRealtimeMetadata } from '@/types/food.types'
import { cn } from '@/lib/utils'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { SwipeableCard } from './SwipeableCard'

interface FoodCardProps {
  food: Food | FoodWithRealtimeMetadata
  category?: Category
  onEdit?: (food: Food) => void
  onDelete?: (food: Food) => void
  showHintAnimation?: boolean
}

/**
 * Get expiry status and color based on days until expiry.
 * Normalizes dates to midnight for accurate calendar day difference.
 */
function getExpiryStatus(expiryDate: string): {
  status: 'expired' | 'critical' | 'warning' | 'good'
  colorClasses: string
  badgeText: string
  daysUntilExpiry: number
} {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)

  const daysUntilExpiry = differenceInDays(expiry, now)

  if (daysUntilExpiry < 0) {
    return { status: 'expired', colorClasses: 'bg-red-100 text-red-800 border-red-200', badgeText: 'Scaduto', daysUntilExpiry }
  }
  if (daysUntilExpiry === 0) {
    return { status: 'critical', colorClasses: 'bg-red-100 text-red-800 border-red-200', badgeText: 'Scade oggi', daysUntilExpiry }
  }
  if (daysUntilExpiry <= 3) {
    return { status: 'critical', colorClasses: 'bg-orange-100 text-orange-800 border-orange-200', badgeText: `${daysUntilExpiry} giorni`, daysUntilExpiry }
  }
  if (daysUntilExpiry <= 7) {
    return { status: 'warning', colorClasses: 'bg-yellow-100 text-yellow-800 border-yellow-200', badgeText: `${daysUntilExpiry} giorni`, daysUntilExpiry }
  }
  return { status: 'good', colorClasses: 'bg-green-100 text-green-800 border-green-200', badgeText: `${daysUntilExpiry} giorni`, daysUntilExpiry }
}

const STORAGE_LABELS: Record<Food['storage_location'], string> = {
  fridge: 'Frigo',
  freezer: 'Freezer',
  pantry: 'Dispensa',
}

/**
 * Determine which image state to render
 */
type ImageState = 'loading' | 'error' | 'loaded' | 'none'

function getImageState(
  hasImageUrl: boolean,
  isLoading: boolean,
  hasError: boolean,
  signedUrl: string | null
): ImageState {
  if (!hasImageUrl) {
    return 'none'
  }
  if (isLoading) {
    return 'loading'
  }
  if (hasError || !signedUrl) {
    return 'error'
  }
  return 'loaded'
}

/**
 * FoodCard Component - Displays a single food item with expiry status
 */
export function FoodCard({ food, category, onEdit, onDelete, showHintAnimation = false }: FoodCardProps) {
  const { colorClasses, badgeText, daysUntilExpiry } = getExpiryStatus(food.expiry_date)
  const formattedExpiryDate = format(new Date(food.expiry_date), 'dd MMM yyyy', { locale: it })

  // Generate signed URL for private image
  const { signedUrl, isLoading: imageLoading, error: imageError } = useSignedUrl(food.image_url)

  // Check if this is a remote update
  const foodWithMetadata = food as FoodWithRealtimeMetadata
  const isRemoteUpdate = foodWithMetadata.isRemoteUpdate || false

  return (
    <SwipeableCard
      onEdit={onEdit ? () => onEdit(food) : undefined}
      onDelete={onDelete ? () => onDelete(food) : undefined}
      showHintAnimation={showHintAnimation}
    >
      <Card
        className={cn(
          'hover:shadow-md transition-shadow',
          daysUntilExpiry <= 3 && 'border-orange-300',
          isRemoteUpdate && 'ring-2 ring-blue-500 animate-pulse'
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-lg font-semibold text-foreground line-clamp-2">
                {food.name}
                {food.quantity && (
                  <span className="font-normal text-muted-foreground ml-1">
                    ({food.quantity} {food.quantity_unit || 'pz'})
                  </span>
                )}
              </CardTitle>
            </div>
            <div
              className={cn('px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap', colorClasses)}
              role="status"
              aria-label={`Stato scadenza: ${badgeText}`}
            >
              {badgeText}
            </div>
          </div>
        </CardHeader>

      <CardContent className="pb-3 space-y-2">
        {/* Food Image */}
        {(() => {
          const imageState = getImageState(!!food.image_url, imageLoading, !!imageError, signedUrl)

          switch (imageState) {
            case 'loading':
              return (
                <div className="w-full h-40 rounded-lg overflow-hidden bg-muted/20 mb-3 relative">
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-muted-foreground/70 animate-spin" />
                  </div>
                </div>
              )

            case 'error':
              return (
                <div className="w-full h-40 rounded-lg overflow-hidden bg-muted/20 mb-3 relative">
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/70">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <span className="text-xs">Errore caricamento</span>
                  </div>
                </div>
              )

            case 'loaded':
              return (
                <div className="w-full h-40 rounded-lg overflow-hidden bg-muted/20 mb-3 relative">
                  <img
                    src={signedUrl!}
                    alt={food.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
              )

            case 'none':
              return (
                <div className="w-full h-40 rounded-lg bg-muted/20 flex items-center justify-center mb-3 border-2 border-dashed border-border">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                </div>
              )
          }
        })()}

        {/* Category + Storage Location (same row with space between) */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {category && (
            <div className="flex items-center gap-1.5">
              <Package className="h-4 w-4 text-muted-foreground/70" />
              <span>{category.name_it}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-muted-foreground/70" />
            <span>{STORAGE_LABELS[food.storage_location]}</span>
          </div>
        </div>

        {/* Expiry Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 text-muted-foreground/70" />
          <span>Scadenza: {formattedExpiryDate}</span>
        </div>

        {/* Notes - Highlighted as user content */}
        {food.notes && (
          <div className="text-sm text-foreground/90 line-clamp-2 mt-2 bg-amber-100 dark:bg-amber-900/20 rounded-md px-3 py-2 border border-amber-200 dark:border-amber-800/30">
            {food.notes}
          </div>
        )}
      </CardContent>

      {/* Action buttons - hidden on mobile (swipe gestures), visible on desktop */}
      <CardFooter className="hidden sm:flex gap-2 pt-2">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(food)}
            className="flex-1"
            aria-label={`Modifica ${food.name}`}
          >
            <Edit className="h-4 w-4 mr-2" aria-hidden="true" />
            Modifica
          </Button>
        )}
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(food)}
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
            aria-label={`Elimina ${food.name}`}
          >
            <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
            Elimina
          </Button>
        )}
      </CardFooter>
    </Card>
    </SwipeableCard>
  )
}
