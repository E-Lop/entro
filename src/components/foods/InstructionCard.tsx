import { SwipeableCard } from './SwipeableCard'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { ArrowRight, ArrowLeft, Info, X } from 'lucide-react'

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
      <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            <CardTitle as="h3" className="text-lg font-semibold text-foreground">
              Come funziona
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pb-4">
          {/* Instructions: one bordered container with two rows (no nested cards) */}
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground text-xs font-medium">Su smartphone</p>

            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              <div className="flex items-start gap-3 p-3">
                <ArrowRight className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Swipe verso destra</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Modifica un alimento</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3">
                <ArrowLeft className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Swipe verso sinistra</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Elimina un alimento</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hint to dismiss */}
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-xs text-foreground font-medium">
              💡 I tuoi alimenti appariranno qui
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Fai swipe a sinistra per eliminare questa card
            </p>
          </div>
        </CardContent>

        {/* Dismiss button - hidden on mobile (swipe gesture), visible on desktop */}
        <CardFooter className="hidden sm:flex pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
            className="w-full"
            aria-label="Elimina card informativa"
          >
            <X className="h-4 w-4 mr-2" aria-hidden="true" />
            Chiudi
          </Button>
        </CardFooter>
      </Card>
    </SwipeableCard>
  )
}
