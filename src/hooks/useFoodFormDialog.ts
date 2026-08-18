import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { onlineManager } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { useCreateFood, useUpdateFood, useDeleteFood } from './useFoods'
import type { Food, FoodInsert, FoodUpdate, FoodOutcome } from '@/lib/foods'
import type { FoodFormData } from '@/lib/validations/food.schemas'
import { triggerHaptic } from '@/lib/haptics'
import { logError } from '@/lib/safeLog'
import { restoreFocusTo } from '@/lib/focusAfterRemoval'

/**
 * Upload or persist an image File depending on online/offline state.
 * Returns the storage path, pending:// URL, or the fallback value on failure.
 */
async function resolveImageFile(
  file: File,
  userId: string,
  isOnline: boolean,
  fallback: string | null = null,
): Promise<string | null> {
  if (isOnline) {
    try {
      const { uploadFoodImage } = await import('@/lib/storage')
      return await uploadFoodImage(file, userId)
    } catch (error) {
      logError('Image upload failed:', error)
      return fallback
    }
  }

  // Offline: persist compressed image in IndexedDB for later upload
  try {
    const { savePendingImage } = await import('@/lib/pendingImages')
    return await savePendingImage(file)
  } catch (error) {
    logError('Failed to save pending image:', error)
    return fallback
  }
}

export function useFoodFormDialog() {
  const { user } = useAuth()

  // Mutations
  const createMutation = useCreateFood()
  const updateMutation = useUpdateFood()
  const deleteMutation = useDeleteFood()

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [deletingFood, setDeletingFood] = useState<Food | null>(null)

  const handleCreateFood = async (data: FoodFormData) => {
    const isOnline = onlineManager.isOnline()

    let imagePath: string | null = null
    if (data.image_url instanceof File) {
      imagePath = await resolveImageFile(data.image_url, user!.id, isOnline)
    } else if (typeof data.image_url === 'string') {
      imagePath = data.image_url
    }

    const foodData: FoodInsert = {
      ...data,
      quantity: data.quantity ?? null,
      quantity_unit: data.quantity_unit ?? null,
      notes: data.notes ?? null,
      image_url: imagePath,
      status: 'active',
      user_id: user!.id,
      list_id: null, // Will be set by createFood()
      barcode: null,
      consumed_at: null,
      deleted_at: null,
    }

    // Use mutate (not mutateAsync) to avoid blocking when offline.
    // mutateAsync returns a Promise that never resolves when the mutation
    // is paused, causing the form to hang on "Creazione in corso...".
    createMutation.mutate({ data: foodData, id: crypto.randomUUID() })
    triggerHaptic('success')
    setIsAddDialogOpen(false)

    if (!isOnline) {
      toast.info('Alimento salvato offline. Verrà sincronizzato quando torni online.')
    }
  }

  const handleUpdateFood = async (data: FoodFormData) => {
    if (!editingFood) return
    const isOnline = onlineManager.isOnline()

    let imagePath: string | null | undefined
    if (data.image_url instanceof File) {
      imagePath = await resolveImageFile(data.image_url, user!.id, isOnline, editingFood.image_url)
    } else {
      imagePath = data.image_url ?? undefined
    }

    // Exclude image_url from spread since we handle it separately
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { image_url: _imageUrl, ...dataWithoutImage } = data

    const foodData: FoodUpdate = {
      ...dataWithoutImage,
      image_url: imagePath,
    }

    updateMutation.mutate({ id: editingFood.id, data: foodData })
    triggerHaptic('success')
    setEditingFood(null)

    if (!isOnline) {
      toast.info('Modifica salvata offline. Verrà sincronizzata quando torni online.')
    }
  }

  const deleteOpenerRef = useRef<HTMLElement | null>(null)

  const handleDeleteFood = (outcome?: FoodOutcome) => {
    if (!deletingFood) return

    // Obbligo simmetrico a quello della chiusura del dialogo: se la scrittura
    // fallisce, `onError` ripristina la lista e la card **ricompare** — il
    // fuoco deve tornarci, altrimenti resta dove l'aveva messo la rimozione,
    // cioè su una riga che ora non è più quella che l'utente stava guardando.
    // È il caso in cui l'utente è già disorientato dall'errore.
    const removedId = deletingFood.id
    deleteMutation.mutate(
      { id: removedId, outcome },
      {
        // Al frame successivo: `onError` ripristina la cache, ma la card torna
        // nel DOM solo dopo il re-render di React.
        onError: () => requestAnimationFrame(() => restoreFocusTo(removedId)),
      }
    )
    triggerHaptic('error')
    setDeletingFood(null)

    if (!onlineManager.isOnline()) {
      toast.info('Eliminazione salvata offline. Verrà sincronizzata quando torni online.')
    }
  }

  const handleEditClick = (food: Food) => {
    setEditingFood(food)
  }

  const handleDeleteClick = (food: Food) => {
    // Il fuoco è ancora sul pulsante che è stato appena premuto: è l'unico
    // momento in cui si può sapere a chi restituirlo se l'utente annulla.
    deleteOpenerRef.current = document.activeElement as HTMLElement | null
    setDeletingFood(food)
  }

  return {
    // State
    isAddDialogOpen,
    setIsAddDialogOpen,
    editingFood,
    setEditingFood,
    deletingFood,
    setDeletingFood,
    // Handlers
    handleCreateFood,
    handleUpdateFood,
    handleDeleteFood,
    deleteOpenerRef,
    handleEditClick,
    handleDeleteClick,
    // Mutation state
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
