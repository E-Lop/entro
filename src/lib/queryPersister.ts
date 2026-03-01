import { get, set, del } from 'idb-keyval'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

const IDB_KEY = 'entro-react-query-cache'

/**
 * IndexedDB persister for React Query.
 * Stores the full query+mutation cache so data survives page reloads
 * and is available immediately when the app opens offline.
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(IDB_KEY, client)
    },
    restoreClient: async () => {
      return get<PersistedClient>(IDB_KEY)
    },
    removeClient: async () => {
      await del(IDB_KEY)
    },
  }
}

/**
 * Clear the persisted cache from IndexedDB.
 * Called on logout to prevent stale data for the next user.
 */
export async function clearPersistedCache(): Promise<void> {
  await del(IDB_KEY)
}
