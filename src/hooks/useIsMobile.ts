import { useSyncExternalStore } from 'react'

const MOBILE_QUERY = '(max-width: 767px)'

// Singleton condiviso: una sola `MediaQueryList` e un solo listener `change`
// per l'intera app, a prescindere da quanti componenti usano l'hook.
let mediaQuery: MediaQueryList | null = null
const listeners = new Set<() => void>()

// Ritorna null dove `matchMedia` non esiste (SSR e jsdom nei test): in quel
// caso l'hook degrada a "non mobile" invece di lanciare.
function getMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }
  if (!mediaQuery) {
    mediaQuery = window.matchMedia(MOBILE_QUERY)
  }
  return mediaQuery
}

function notify() {
  for (const listener of listeners) listener()
}

// Si attacca al primo subscriber e si stacca all'ultimo unmount: con N
// consumer monta comunque un solo `change` listener (a differenza del
// precedente `resize` listener per-card in SwipeableCard).
function subscribe(onStoreChange: () => void): () => void {
  const mql = getMediaQuery()
  if (!mql) return () => {}
  if (listeners.size === 0) {
    mql.addEventListener('change', notify)
  }
  listeners.add(onStoreChange)

  return () => {
    listeners.delete(onStoreChange)
    if (listeners.size === 0) {
      mql.removeEventListener('change', notify)
    }
  }
}

function hasTouchScreen(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

function getSnapshot(): boolean {
  const mql = getMediaQuery()
  return hasTouchScreen() && !!mql && mql.matches
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * useIsMobile — `true` su dispositivi touch con viewport ≤ 767px.
 *
 * Hook condiviso: tutti i consumer leggono lo stesso store con una **sola**
 * sottoscrizione `matchMedia` (via `useSyncExternalStore` + singleton),
 * così una lista di N card non monta N listener duplicati.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
