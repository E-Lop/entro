import { SwipeableCard } from './SwipeableCard'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { ArrowRight, ArrowLeft, Info } from 'lucide-react'

interface InstructionCardProps {
  onDismiss: () => void
}

/**
 * InstructionCard - Dummy card with swipe gesture instructions
 *
 * Shows swipe instructions for new users who don't have any food items yet.
 * Can be dismissed by swiping left (delete gesture).
 * Demonstrates both edit and delete swipe directions.
 */
export function InstructionCard({ onDismiss }: InstructionCardProps) {
  return (
    <SwipeableCard
      onEdit={undefined} // No edit action on instruction card
      onDelete={onDismiss} // Swipe left dismisses the card
      showHintAnimation={true} // Always show animation on this card
    >
      <Card className="border-2 border-dashed border-blue-300 bg-blue-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg font-semibold text-blue-900">
              Come funziona
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-4">
          {/* Instructions */}
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-blue-200">
              <ArrowRight className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Swipe verso destra</p>
                <p className="text-slate-600 text-xs mt-0.5">Modifica un alimento</p>
              </div>
            </div>

            <div className="flex items-start gap-3 bg-white rounded-lg p-3 border border-blue-200">
              <ArrowLeft className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Swipe verso sinistra</p>
                <p className="text-slate-600 text-xs mt-0.5">Elimina un alimento</p>
              </div>
            </div>
          </div>

          {/* Hint to dismiss */}
          <div className="bg-blue-100 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-800 font-medium">
              💡 I tuoi alimenti appariranno qui
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Fai swipe a sinistra per eliminare questa card
            </p>
          </div>
        </CardContent>
      </Card>
    </SwipeableCard>
  )
}
