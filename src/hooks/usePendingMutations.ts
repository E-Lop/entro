import { useMutationState } from '@tanstack/react-query'

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
