import { lazy, Suspense } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import type { Food, FoodOutcome } from '@/lib/foods'
import type { FoodFormData } from '@/lib/validations/food.schemas'

const FoodForm = lazy(() => import('./FoodForm').then(m => ({ default: m.FoodForm })))

const FormSpinner = () => (
  <div className="flex justify-center py-8" role="status" aria-live="polite">
    <div className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-border border-t-primary" aria-hidden="true" />
    <span className="sr-only">Caricamento modulo...</span>
  </div>
)

interface FoodModalsProps {
  isAddDialogOpen: boolean
  onAddDialogChange: (open: boolean) => void
  onCreateFood: (data: FoodFormData) => Promise<void>
  isCreating: boolean
  editingFood: Food | null
  onEditDialogChange: (open: boolean) => void
  onUpdateFood: (data: FoodFormData) => Promise<void>
  isUpdating: boolean
  deletingFood: Food | null
  onDeleteDialogChange: (open: boolean) => void
  onDeleteFood: (outcome?: FoodOutcome) => void
  isDeleting: boolean
}

export function FoodModals({
  isAddDialogOpen,
  onAddDialogChange,
  onCreateFood,
  isCreating,
  editingFood,
  onEditDialogChange,
  onUpdateFood,
  isUpdating,
  deletingFood,
  onDeleteDialogChange,
  onDeleteFood,
  isDeleting,
}: FoodModalsProps) {
  return (
    <>
      {/* Add Food Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={onAddDialogChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aggiungi Nuovo Alimento</DialogTitle>
          </DialogHeader>
          <Suspense fallback={<FormSpinner />}>
            <FoodForm
              mode="create"
              onSubmit={onCreateFood}
              onCancel={() => onAddDialogChange(false)}
              isSubmitting={isCreating}
            />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Edit Food Dialog */}
      <Dialog open={!!editingFood} onOpenChange={(open) => !open && onEditDialogChange(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Alimento</DialogTitle>
          </DialogHeader>
          {editingFood && (
            <Suspense fallback={<FormSpinner />}>
              <FoodForm
                mode="edit"
                initialData={editingFood}
                onSubmit={onUpdateFood}
                onCancel={() => onEditDialogChange(false)}
                isSubmitting={isUpdating}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>

      {/* Conferma eliminazione: chiede com'è finita, non «sei sicuro?» */}
      <AlertDialog open={!!deletingFood} onOpenChange={(open) => !open && onDeleteDialogChange(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Com'è finita?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deletingFood?.name}» esce dalla lista. Dirci come aiuta a capire quanto cibo
              finisce nella spazzatura — se è stato un errore, puoi togliere e basta.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* In colonna: sono tre scelte fra pari, non un'azione con due varianti.
              Su telefono resta anche l'unica disposizione che tiene i bersagli larghi. */}
          <div className="flex flex-col gap-2 py-2">
            <AlertDialogAction
              onClick={() => onDeleteFood('consumed')}
              disabled={isDeleting}
              className="h-11 w-full justify-start"
            >
              <Check className="h-4 w-4 mr-2" aria-hidden="true" />
              L'ho consumato
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => onDeleteFood('wasted')}
              disabled={isDeleting}
              className="h-11 w-full justify-start bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
              L'ho buttato
            </AlertDialogAction>
            {/* Nessun esito: è l'errore di inserimento. Sporcare la metrica
                anti-spreco con gli errori la rende inutile quanto lasciarla vuota. */}
            <AlertDialogAction
              onClick={() => onDeleteFood()}
              disabled={isDeleting}
              className="h-11 w-full justify-start bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              <X className="h-4 w-4 mr-2" aria-hidden="true" />
              Toglilo e basta
            </AlertDialogAction>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Annulla</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
