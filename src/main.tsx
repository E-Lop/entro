import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createIDBPersister } from './lib/queryPersister'
import { registerMutationDefaults } from './lib/mutationDefaults'
import './index.css'
import App from './App.tsx'

// Keep React Query's online state in sync with the browser
onlineManager.setEventListener((setOnline) => {
  const onlineHandler = () => setOnline(true)
  const offlineHandler = () => setOnline(false)
  window.addEventListener('online', onlineHandler)
  window.addEventListener('offline', offlineHandler)
  return () => {
    window.removeEventListener('online', onlineHandler)
    window.removeEventListener('offline', offlineHandler)
  }
})

// Create React Query client
const queryClient = new QueryClient({
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

// Register mutation defaults so paused mutations can resume after page reload
registerMutationDefaults(queryClient)

// IndexedDB persister for cache + mutations
const persister = createIDBPersister()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        buster: '', // Change this to bust the cache when data shape changes
      }}
      onSuccess={() => {
        // After restoring from IndexedDB, resume any paused mutations
        queryClient.resumePausedMutations().then(() => {
          queryClient.invalidateQueries()
        })
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
