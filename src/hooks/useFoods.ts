import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getFoods,
  getFoodById,
  getCategories,
  createFood,
  updateFood,
  deleteFood,
  updateFoodStatus,
  type Food,
  type FoodInsert,
  type FoodUpdate,
  type FilterParams,
} from '@/lib/foods'
import { mutationTracker } from './useRealtimeFoods'

/**
 * Query keys for React Query cache management
 */
export const foodsKeys = {
  all: ['foods'] as const,
  lists: () => [...foodsKeys.all, 'list'] as const,
  list: (filters?: FilterParams) => [...foodsKeys.lists(), filters || {}] as const,
  details: () => [...foodsKeys.all, 'detail'] as const,
  detail: (id: string) => [...foodsKeys.details(), id] as const,
}

export const categoriesKeys = {
  all: ['categories'] as const,
}

/**
 * Fetch all categories
 */
export function useCategories() {
  return useQuery({
    queryKey: categoriesKeys.all,
    queryFn: async () => {
      const { categories, error } = await getCategories()
      if (error) throw error
      return categories
    },
    staleTime: 1000 * 60 * 60, // Categories are relatively static (1 hour)
  })
}

/**
 * Fetch all foods for current user with optional filters
 */
export function useFoods(filters?: FilterParams) {
  return useQuery({
    queryKey: foodsKeys.list(filters),
    queryFn: async () => {
      const { foods, error } = await getFoods(filters)
      if (error) throw error
      return foods
    },
  })
}

/**
 * Fetch a single food by ID
 */
export function useFoodById(id: string | undefined) {
  return useQuery({
    queryKey: foodsKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null
      const { food, error } = await getFoodById(id)
      if (error) throw error
      return food
    },
    enabled: !!id, // Only run query if id is provided
  })
}

/**
 * Create a new food item
 */
export function useCreateFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: FoodInsert) => {
      const { food, error } = await createFood(data)
      if (error) throw error
      if (!food) throw new Error('Nessun dato restituito')
      return food
    },
    onSuccess: (newFood) => {
      // Track mutation for deduplication
      console.log('[useFoods] Tracking local INSERT mutation for:', newFood.id, newFood.name)
      mutationTracker.track(newFood.id, 'INSERT')

      // Invalidate and refetch foods list
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
      toast.success('Alimento aggiunto con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nella creazione dell\'alimento')
    },
  })
}

/**
 * Update an existing food item
 */
export function useUpdateFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FoodUpdate }) => {
      const { food, error } = await updateFood(id, data)
      if (error) throw error
      if (!food) throw new Error('Nessun dato restituito')
      return food
    },
    onSuccess: (updatedFood) => {
      // Track mutation for deduplication
      mutationTracker.track(updatedFood.id, 'UPDATE')

      // Invalidate foods list and specific food detail
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(updatedFood.id) })
      toast.success('Alimento aggiornato con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'aggiornamento dell\'alimento')
    },
  })
}

/**
 * Delete a food item
 */
export function useDeleteFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await deleteFood(id)
      if (error) throw error
    },
    onMutate: async (deletedId) => {
      // Track mutation for deduplication
      mutationTracker.track(deletedId, 'DELETE')

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })

      // Snapshot previous value
      const previousFoods = queryClient.getQueryData<Food[]>(foodsKeys.lists())

      // Optimistically update cache by removing the deleted item
      if (previousFoods) {
        queryClient.setQueryData<Food[]>(
          foodsKeys.lists(),
          previousFoods.filter((food) => food.id !== deletedId)
        )
      }

      return { previousFoods }
    },
    onError: (error: Error, _deletedId, context) => {
      // Rollback on error
      if (context?.previousFoods) {
        queryClient.setQueryData(foodsKeys.lists(), context.previousFoods)
      }
      toast.error(error.message || 'Errore nell\'eliminazione dell\'alimento')
    },
    onSuccess: () => {
      toast.success('Alimento eliminato con successo')
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
    },
  })
}

/**
 * Update food status (consumed, expired, wasted)
 */
export function useUpdateFoodStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Food['status'] }) => {
      const { food, error } = await updateFoodStatus(id, status)
      if (error) throw error
      if (!food) throw new Error('Nessun dato restituito')
      return food
    },
    onSuccess: (updatedFood) => {
      // Track mutation for deduplication
      mutationTracker.track(updatedFood.id, 'UPDATE')

      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(updatedFood.id) })
      toast.success('Stato aggiornato con successo')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nell\'aggiornamento dello stato')
    },
  })
}
