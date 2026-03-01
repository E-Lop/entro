import { useQuery, useMutation, useQueryClient, onlineManager } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getFoods,
  getFoodById,
  getCategories,
  type Food,
  type FoodInsert,
  type FoodUpdate,
  type FilterParams,
} from '@/lib/foods'
import { mutationKeys } from '@/lib/mutationDefaults'

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
    enabled: !!id,
  })
}

/**
 * Create a new food item.
 * Generates a client-side UUID so the item appears in the cache immediately
 * (optimistic update) and works offline.
 *
 * Note: mutationFn is provided by registerMutationDefaults() so that
 * paused mutations can resume after a page reload.
 */
export function useCreateFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.createFood,
    onMutate: async (variables: { data: FoodInsert; id: string }) => {
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })

      const optimisticFood: Food = {
        id: variables.id,
        name: variables.data.name,
        expiry_date: variables.data.expiry_date,
        category_id: variables.data.category_id ?? null,
        storage_location: variables.data.storage_location ?? 'fridge',
        quantity: variables.data.quantity ?? null,
        quantity_unit: variables.data.quantity_unit ?? null,
        notes: variables.data.notes ?? null,
        image_url: variables.data.image_url ?? null,
        barcode: variables.data.barcode ?? null,
        status: variables.data.status ?? 'active',
        consumed_at: null,
        deleted_at: null,
        user_id: '',
        list_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueriesData<Food[]>(
        { queryKey: foodsKeys.lists() },
        (old) => old ? [optimisticFood, ...old] : [optimisticFood],
      )

      return { optimisticFood }
    },
    onSuccess: () => {
      if (onlineManager.isOnline()) {
        toast.success('Alimento aggiunto con successo')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Errore nella creazione dell\'alimento')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
    },
  })
}

/**
 * Update an existing food item.
 *
 * Note: mutationFn is provided by registerMutationDefaults().
 */
export function useUpdateFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.updateFood,
    onMutate: async ({ id, data }: { id: string; data: FoodUpdate }) => {
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })
      await queryClient.cancelQueries({ queryKey: foodsKeys.detail(id) })

      const previousLists = queryClient.getQueriesData<Food[]>({ queryKey: foodsKeys.lists() })

      queryClient.setQueriesData<Food[]>(
        { queryKey: foodsKeys.lists() },
        (old) => old?.map((food) => (food.id === id ? { ...food, ...data } : food)),
      )

      queryClient.setQueryData<Food>(
        foodsKeys.detail(id),
        (old) => old ? { ...old, ...data } : old,
      )

      return { previousLists }
    },
    onSuccess: () => {
      if (onlineManager.isOnline()) {
        toast.success('Alimento aggiornato con successo')
      }
    },
    onError: (error: Error, { id }: { id: string; data: FoodUpdate }, context) => {
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(id) })
      toast.error(error.message || 'Errore nell\'aggiornamento dell\'alimento')
    },
    onSettled: (_data, _error, { id }: { id: string; data: FoodUpdate }) => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(id) })
    },
  })
}

/**
 * Delete a food item.
 *
 * Note: mutationFn is provided by registerMutationDefaults().
 */
export function useDeleteFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.deleteFood,
    onMutate: async (deletedId: string) => {
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })

      const previousLists = queryClient.getQueriesData<Food[]>({ queryKey: foodsKeys.lists() })

      queryClient.setQueriesData<Food[]>(
        { queryKey: foodsKeys.lists() },
        (old) => old?.filter((food) => food.id !== deletedId),
      )

      return { previousLists }
    },
    onError: (error: Error, _deletedId: string, context) => {
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      toast.error(error.message || 'Errore nell\'eliminazione dell\'alimento')
    },
    onSuccess: () => {
      if (onlineManager.isOnline()) {
        toast.success('Alimento eliminato con successo')
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
    },
  })
}

/**
 * Update food status (consumed, expired, wasted).
 *
 * Note: mutationFn is provided by registerMutationDefaults().
 */
export function useUpdateFoodStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.updateFoodStatus,
    onMutate: async ({ id, status }: { id: string; status: Food['status'] }) => {
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })
      await queryClient.cancelQueries({ queryKey: foodsKeys.detail(id) })

      const previousLists = queryClient.getQueriesData<Food[]>({ queryKey: foodsKeys.lists() })

      const statusUpdate: Partial<Food> = { status }
      if (status === 'consumed') {
        statusUpdate.consumed_at = new Date().toISOString()
      }

      queryClient.setQueriesData<Food[]>(
        { queryKey: foodsKeys.lists() },
        (old) => old?.map((food) => (food.id === id ? { ...food, ...statusUpdate } : food)),
      )

      queryClient.setQueryData<Food>(
        foodsKeys.detail(id),
        (old) => old ? { ...old, ...statusUpdate } : old,
      )

      return { previousLists }
    },
    onSuccess: () => {
      if (onlineManager.isOnline()) {
        toast.success('Stato aggiornato con successo')
      }
    },
    onError: (error: Error, { id }: { id: string; status: Food['status'] }, context) => {
      if (context?.previousLists) {
        for (const [queryKey, data] of context.previousLists) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(id) })
      toast.error(error.message || 'Errore nell\'aggiornamento dello stato')
    },
    onSettled: (_data, _error, { id }: { id: string; status: Food['status'] }) => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(id) })
    },
  })
}
