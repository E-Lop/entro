import { lazy, Suspense } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { Food } from '@/lib/foods'
import type { FoodFormData } from '@/lib/validations/food.schemas'

const FoodForm = lazy(() => import('./FoodForm').then(m => ({ default: m.FoodForm })))

const FormSpinner = () => (
  <div className="flex justify-center py-8">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
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
  onDeleteFood: () => void
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
            <DialogDescription>
              Inserisci le informazioni dell'alimento da aggiungere
            </DialogDescription>
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
            <DialogDescription>
              Aggiorna le informazioni dell'alimento
            </DialogDescription>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingFood} onOpenChange={(open) => !open && onDeleteDialogChange(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare "{deletingFood?.name}"? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteFood}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
