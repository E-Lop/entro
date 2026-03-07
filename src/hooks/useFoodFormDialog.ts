import { useState } from 'react'
import { toast } from 'sonner'
import { onlineManager } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { useCreateFood, useUpdateFood, useDeleteFood } from './useFoods'
import type { Food, FoodInsert, FoodUpdate } from '@/lib/foods'
import type { FoodFormData } from '@/lib/validations/food.schemas'
import { triggerHaptic } from '@/lib/haptics'

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
      console.error('Image upload failed:', error)
      return fallback
    }
  }

  // Offline: persist compressed image in IndexedDB for later upload
  try {
    const { savePendingImage } = await import('@/lib/pendingImages')
    return await savePendingImage(file)
  } catch (error) {
    console.error('Failed to save pending image:', error)
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

  const handleDeleteFood = () => {
    if (!deletingFood) return

    deleteMutation.mutate(deletingFood.id)
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
    handleEditClick,
    handleDeleteClick,
    // Mutation state
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
