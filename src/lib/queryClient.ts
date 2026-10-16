import { QueryClient } from '@tanstack/react-query'
import { isHeldBackRequest } from './heldBackRequests'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep data for offline use
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep paused mutations for offline sync
      // Solo una richiesta trattenuta perché il rinnovo del token non riesce:
      // il tentativo dopo va in pausa come offline, e la scrittura resta in
      // coda invece di annullarsi (#229, `heldBackRequests.ts`).
      retry: (_failureCount, error) => isHeldBackRequest(error),
    },
  },
})
