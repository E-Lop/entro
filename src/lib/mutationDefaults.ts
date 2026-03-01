import type { QueryClient } from '@tanstack/react-query'
import {
  createFood,
  updateFood,
  deleteFood,
  updateFoodStatus,
  type Food,
  type FoodInsert,
  type FoodUpdate,
} from './foods'
import { mutationTracker } from './realtime'

/**
 * Mutation keys -- must match the keys used in useFoods.ts hooks.
 */
export const mutationKeys = {
  createFood: ['createFood'] as const,
  updateFood: ['updateFood'] as const,
  deleteFood: ['deleteFood'] as const,
  updateFoodStatus: ['updateFoodStatus'] as const,
}

/**
 * Unwrap a food response, throwing on error or missing data.
 */
function unwrapFood({ food, error }: { food: Food | null; error: Error | null }): Food {
  if (error) throw error
  if (!food) throw new Error('Nessun dato restituito')
  return food
}

/**
 * Register mutation defaults on the QueryClient.
 *
 * After a page reload, persisted mutations no longer have their `mutationFn`
 * (functions are not serializable). `setMutationDefaults` re-attaches the
 * correct function so that paused mutations can resume automatically.
 */
export function registerMutationDefaults(queryClient: QueryClient): void {
  queryClient.setMutationDefaults(mutationKeys.createFood, {
    mutationFn: async (variables: { data: FoodInsert; id: string }) => {
      mutationTracker.track(variables.id, 'INSERT')
      return unwrapFood(await createFood(variables.data, variables.id))
    },
  })

  queryClient.setMutationDefaults(mutationKeys.updateFood, {
    mutationFn: async (variables: { id: string; data: FoodUpdate }) => {
      mutationTracker.track(variables.id, 'UPDATE')
      return unwrapFood(await updateFood(variables.id, variables.data))
    },
  })

  queryClient.setMutationDefaults(mutationKeys.deleteFood, {
    mutationFn: async (id: string) => {
      mutationTracker.track(id, 'DELETE')
      const { error } = await deleteFood(id)
      if (error) throw error
    },
  })

  queryClient.setMutationDefaults(mutationKeys.updateFoodStatus, {
    mutationFn: async (variables: { id: string; status: Food['status'] }) => {
      mutationTracker.track(variables.id, 'UPDATE')
      return unwrapFood(await updateFoodStatus(variables.id, variables.status))
    },
  })
}
