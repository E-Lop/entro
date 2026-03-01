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
import { uploadFoodImage } from './storage'
import { isPendingUrl, pendingImageToFile, deletePendingImage } from './pendingImages'

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
 * If image_url is a pending:// reference, upload the image from IndexedDB
 * and return the real storage path. Otherwise return the value unchanged.
 */
async function resolvePendingImage(
  imageUrl: string | null | undefined,
  userId: string,
): Promise<string | null | undefined> {
  if (!isPendingUrl(imageUrl)) return imageUrl

  try {
    const file = await pendingImageToFile(imageUrl)
    const storagePath = await uploadFoodImage(file, userId)
    await deletePendingImage(imageUrl)
    return storagePath
  } catch (error) {
    console.warn('Pending image upload failed, creating food without image:', error)
    await deletePendingImage(imageUrl).catch(() => {})
    return null
  }
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
      // Upload pending image from IndexedDB if present
      variables.data.image_url = await resolvePendingImage(
        variables.data.image_url,
        variables.data.user_id,
      ) ?? null
      mutationTracker.track(variables.id, 'INSERT')
      return unwrapFood(await createFood(variables.data, variables.id))
    },
  })

  queryClient.setMutationDefaults(mutationKeys.updateFood, {
    mutationFn: async (variables: { id: string; data: FoodUpdate }) => {
      if (variables.data.user_id) {
        variables.data.image_url = await resolvePendingImage(
          variables.data.image_url,
          variables.data.user_id,
        )
      }
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
