import { lazy, Suspense, useRef, type RefObject } from 'react'
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
import {
  actionsIndexOf,
  moveFocusAfterRemoval,
  restoreFocusToOpener,
} from '@/lib/focusAfterRemoval'
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
  /** Chi ha aperto la conferma: dove torna il fuoco se l'utente annulla. */
  deleteOpener?: RefObject<HTMLElement | null>
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
  deleteOpener,
}: FoodModalsProps) {
  // Posizione della card che sta per uscire dalla lista, letta prima che
  // l'aggiornamento ottimistico la tolga. `null` significa «il dialogo non è
  // stato chiuso confermando», ed è il valore che distingue Annulla ed Esc.
  const removedIndexRef = useRef<number | null>(null)

  // L'id serve al percorso di annullamento, dove `deletingFood` è già tornato
  // a `null` quando il dialogo si chiude.
  const lastFoodIdRef = useRef<string | null>(null)
  if (deletingFood) lastFoodIdRef.current = deletingFood.id

  const confirmDelete = (outcome?: FoodOutcome) => {
    // Va letta adesso: `onDeleteFood` avvia la mutazione, il cui `onMutate`
    // filtra la card fuori dalla cache. Fra un istante non sarà più nel DOM.
    removedIndexRef.current = deletingFood ? actionsIndexOf(deletingFood.id) : -1

    // `onDeleteFood()` e `onDeleteFood(undefined)` non sono la stessa chiamata
    // per chi la osserva: «toglilo e basta» è l'assenza di esito.
    if (outcome === undefined) onDeleteFood()
    else onDeleteFood(outcome)
  }

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
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            const removedIndex = removedIndexRef.current
            removedIndexRef.current = null

            if (removedIndex !== null) {
              event.preventDefault()
              moveFocusAfterRemoval(removedIndex)
              return
            }

            // Annullato o chiuso con Esc: la card c'è ancora, e il fuoco deve
            // tornare a chi ha aperto il dialogo. Radix dovrebbe farlo da sé e
            // qui **non lo fa** — il dialogo è controllato, senza
            // `AlertDialogTrigger` — e il fuoco finisce su `document.body`,
            // misurato su Chromium. È un difetto preesistente, fratello di
            // quello della #87 su un percorso che la issue dava per sano.
            if (restoreFocusToOpener(deleteOpener?.current ?? null, lastFoodIdRef.current)) {
              event.preventDefault()
            }
          }}
        >
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
              onClick={() => confirmDelete('consumed')}
              disabled={isDeleting}
              className="h-11 w-full justify-start"
            >
              <Check className="h-4 w-4 mr-2" aria-hidden="true" />
              L'ho consumato
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => confirmDelete('wasted')}
              disabled={isDeleting}
              className="h-11 w-full justify-start bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
              L'ho buttato
            </AlertDialogAction>
            {/* Nessun esito: è l'errore di inserimento. Sporcare la metrica
                anti-spreco con gli errori la rende inutile quanto lasciarla vuota. */}
            <AlertDialogAction
              onClick={() => confirmDelete()}
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
