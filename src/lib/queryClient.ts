import { QueryClient } from '@tanstack/react-query'

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
    },
  },
})
