import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSignedImageUrls } from '@/lib/storage'
import { getPendingImage, isPendingUrl } from '@/lib/pendingImages'
import { logError } from '@/lib/safeLog'

/**
 * La chiave di una signed URL: **per percorso**, non per alimento.
 *
 * La usano sia la card sia l'anteprima nel form, quindi le due condividono la
 * stessa voce di cache.
 */
export const signedUrlQueryKey = (path: string) => ['signed-url', path] as const

/** Quanto vale una signed URL. È il default di `getSignedImageUrls`. */
const SIGNED_URL_SECONDS = 3600

/**
 * Cinque minuti prima della scadenza: il rinnovo deve precedere l'ora, o una
 * card rimontata riceverebbe dalla cache un token già morto.
 */
export const SIGNED_URL_STALE_MS = (SIGNED_URL_SECONDS - 5 * 60) * 1000

type Waiter = { resolve: (url: string | null) => void; reject: (error: unknown) => void }

/** I percorsi chiesti in questo giro, e chi aspetta ciascuno. */
let pending: Map<string, Waiter[]> | null = null

/**
 * Parte la richiesta per tutto ciò che si è accumulato nel giro.
 *
 * Una `createSignedUrls` sola, e ognuno riceve la propria voce: `null` per un
 * oggetto che non c'è, che è uno stato previsto e non fa fallire le altre. Se
 * fallisce la chiamata intera, fallisce ogni voce del giro.
 */
async function flush() {
  const round = pending
  pending = null
  if (!round) return

  try {
    const urls = await getSignedImageUrls([...round.keys()], SIGNED_URL_SECONDS)
    for (const [path, waiters] of round) {
      for (const waiter of waiters) waiter.resolve(urls.get(path) ?? null)
    }
  } catch (error) {
    for (const waiters of round.values()) {
      for (const waiter of waiters) waiter.reject(error)
    }
  }
}

/**
 * La URL di un percorso, firmata insieme agli altri chiesti nello stesso giro.
 *
 * È il batching dentro la `queryFn` che i maintainer di TanStack Query indicano
 * quando l'API lo supporta (discussions/5860), ed è lo stesso disegno di
 * entro-mobile (`useSignedImageUrl`): ogni card ha la sua query e la sua voce
 * di cache, e quelle che montano insieme partono in una richiesta sola. Il giro
 * è un `setTimeout(0)` e non una microtask, così le query che partono negli
 * effetti dello stesso commit finiscono tutte dentro.
 *
 * Nessuna cache qui: la tiene React Query, e una seconda cache davanti a lei
 * servirebbe URL scadute senza che `staleTime` lo sappia.
 */
function loadSignedUrl(path: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (!pending) {
      pending = new Map()
      setTimeout(() => void flush(), 0)
    }
    const waiters = pending.get(path) ?? []
    waiters.push({ resolve, reject })
    pending.set(path, waiters)
  })
}

/**
 * Il percorso da firmare, o `null` per ciò che non si firma: nessuna foto, una
 * foto scattata offline (`pending://`, servita da IndexedDB) e l'URL intero
 * che alcune righe legacy tengono in `image_url` (`core/food-images.md` nel
 * bundle), che si usa com'è.
 */
function remotePath(ref: string | null | undefined): string | null {
  if (!ref || ref.startsWith('http') || isPendingUrl(ref)) return null
  return ref
}

/**
 * La lista mette in coda **tutte** le sue foto insieme, prima che le card le
 * chiedano una a una.
 *
 * Le card possono montare in più passate, e ogni passata aprirebbe un giro
 * suo. La lista i percorsi li conosce già: `prefetchQuery` rispetta
 * `staleTime`, quindi una URL ancora buona non si richiede, e le card che
 * montano dopo trovano la loro query in volo o fresca.
 */
export function usePrefetchSignedUrls(refs: readonly (string | null | undefined)[]) {
  const queryClient = useQueryClient()
  const paths = [...new Set(refs.map(remotePath).filter((path): path is string => path !== null))]
  const signature = paths.join('\n')

  useEffect(() => {
    if (!signature) return
    for (const path of signature.split('\n')) {
      void queryClient.prefetchQuery({
        queryKey: signedUrlQueryKey(path),
        queryFn: () => loadSignedUrl(path),
        staleTime: SIGNED_URL_STALE_MS,
      })
    }
  }, [queryClient, signature])
}

/**
 * Una foto scattata offline: sta in IndexedDB e si mostra come blob URL, che
 * va revocato quando la card smonta o la foto cambia. Non passa da React Query:
 * un blob URL in cache sopravvivrebbe alla revoca.
 */
function usePendingImageUrl(pendingUrl: string | null) {
  const [state, setState] = useState<{ url: string | null; error: Error | null }>({
    url: null,
    error: null,
  })

  useEffect(() => {
    setState({ url: null, error: null })
    if (!pendingUrl) return

    let cancelled = false
    let blobUrl: string | null = null

    getPendingImage(pendingUrl)
      .then(({ buffer, type }) => {
        if (cancelled) return
        blobUrl = URL.createObjectURL(new Blob([buffer], { type }))
        setState({ url: blobUrl, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const error =
          err instanceof Error ? err : new Error("Errore nel caricamento dell'immagine")
        logError('Error loading image URL:', error)
        setState({ url: null, error })
      })

    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [pendingUrl])

  return { ...state, isLoading: pendingUrl !== null && !state.url && !state.error }
}

/**
 * La URL con cui mostrare la foto di un alimento.
 *
 * `signedUrl` è `null` anche quando l'oggetto non esiste più: è uno stato
 * previsto, non un errore, e l'alimento si mostra senza foto. Una foto
 * sostituita non riusa la URL vecchia dalla cache perché ha un percorso nuovo.
 */
export function useSignedUrl(storagePath: string | null | undefined) {
  const path = remotePath(storagePath)
  const pendingUrl = isPendingUrl(storagePath) ? storagePath : null

  const remote = useQuery({
    queryKey: signedUrlQueryKey(path ?? ''),
    queryFn: () => loadSignedUrl(path as string),
    enabled: path !== null,
    staleTime: SIGNED_URL_STALE_MS,
  })
  const local = usePendingImageUrl(pendingUrl)

  if (pendingUrl) return { signedUrl: local.url, isLoading: local.isLoading, error: local.error }
  if (path) {
    return { signedUrl: remote.data ?? null, isLoading: remote.isPending, error: remote.error }
  }
  // Niente da firmare: nessuna foto, o un URL intero che si usa com'è.
  return { signedUrl: storagePath ?? null, isLoading: false, error: null }
}
