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

/**
 * Ask the browser to exempt our IndexedDB cache from automatic eviction.
 *
 * Verified support (MDN `api.StorageManager.persist`, 2026-06-17):
 * Chrome 55+, Firefox 57+, Safari/iOS 15.2+. Best-effort by design: iOS Safari
 * grants persistence heuristically (e.g. once the PWA is installed), so a
 * `false` result is normal — the WebKit ~7-day eviction of non-persistent
 * storage may still apply to in-browser (non-installed) use. Never throws.
 *
 * @returns whether persistent storage was granted
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
