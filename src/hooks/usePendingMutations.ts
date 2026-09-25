import { useMutationState } from '@tanstack/react-query'
import { mutationKeys } from '@/lib/mutationDefaults'

/**
 * Returns the number of mutations that are currently pending (paused or in progress).
 * Useful for showing sync indicators in the UI.
 */
export function usePendingMutationsCount(): number {
  const pending = useMutationState({
    filters: { status: 'pending' },
    select: (mutation) => mutation.state.status,
  })

  return pending.length
}

const FOOD_WRITE_KEYS = new Set<string>(
  [mutationKeys.createFood, mutationKeys.updateFood, mutationKeys.deleteFood, mutationKeys.updateFoodStatus].map(
    ([key]) => key,
  ),
)

/**
 * Se l'alimento `id` ha una scrittura non ancora arrivata al server: in volo,
 * o in coda offline. Blocca le azioni su **quell'**alimento e non sugli altri
 * (#153): prima la guardia era `mutation.isPending`, globale, e una rimozione
 * in coda offline impediva di toglierne un secondo.
 */
export function useFoodHasPendingWrite(id: string | null | undefined): boolean {
  const pending = useMutationState({
    filters: {
      status: 'pending',
      predicate: (mutation) =>
        id != null &&
        FOOD_WRITE_KEYS.has(String(mutation.options.mutationKey?.[0])) &&
        (mutation.state.variables as { id?: string } | undefined)?.id === id,
    },
    select: (mutation) => mutation.state.status,
  })
  return pending.length > 0
}
