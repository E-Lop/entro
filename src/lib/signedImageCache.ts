/**
 * La cache delle foto nel service worker: quali richieste prende, sotto che
 * chiave, e quali risposte tiene (#211).
 *
 * Sta fuori da `sw.ts` perché lì dentro non si può provare niente: un service
 * worker non si importa in un test. Qui sono funzioni e costanti.
 */

/** Le signed URL di Storage hanno tutte questo tratto di percorso. */
const SIGNED_OBJECT_PATH = '/storage/v1/object/sign/'

/** La Supabase locale: senza, la rotta in sviluppo non scatta e non si prova. */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/**
 * Una signed URL di Supabase Storage, in produzione o sulla Supabase locale.
 */
export function isSignedImageUrl(url: URL): boolean {
  if (!url.pathname.includes(SIGNED_OBJECT_PATH)) return false
  return url.hostname.endsWith('.supabase.co') || LOCAL_HOSTS.has(url.hostname)
}

/**
 * La chiave di cache: l'URL senza la query, cioè senza il token.
 *
 * Ogni signed URL della stessa foto ha un token diverso, e con la query nella
 * chiave nessuna richiesta ritroverebbe mai la voce di quella prima.
 */
export function signedImageCacheKey(requestUrl: string): string {
  const url = new URL(requestUrl)
  url.search = ''
  return url.href
}

/**
 * Solo il 200, mai lo 0 delle risposte opache.
 *
 * Con la chiave senza token e una strategia cache-first, una risposta d'errore
 * finita in cache viene servita al posto della foto a ogni signed URL nuova,
 * anche valida, fino alla scadenza della voce. E di una risposta opaca non si
 * può leggere lo stato: un 400 per token scaduto è indistinguibile da un 200.
 * È il caso da cui mette in guardia Workbox («caching an error response can
 * result in a persistently broken experience if a cache-first or cache-only
 * strategy is used», *Caching resources during runtime*), ed è successo: fino
 * alla 1.15.5 qui c'era `[0, 200]`.
 *
 * Perché il 200 si possa leggere, l'`<img>` deve chiedere la foto in CORS:
 * vedi `crossOrigin` in `FoodCard`.
 */
export const SIGNED_IMAGE_CACHEABLE_STATUSES = [200]

/**
 * Il nome ha una versione perché cambiarlo è l'unico modo di buttare le voci
 * già salvate sui dispositivi.
 */
export const SIGNED_IMAGE_CACHE = 'supabase-images-v2'

/**
 * Le cache di prima, da cancellare all'attivazione. `supabase-images-cache`
 * può contenere risposte d'errore opache salvate al posto delle foto.
 */
export const OBSOLETE_IMAGE_CACHES = ['supabase-images-cache']

/**
 * Svuota la cache delle foto: si chiama quando chi usa questo dispositivo
 * perde l'accesso alle foto che ha visto (#213).
 *
 * Serve perché la cache risponde **prima** di Storage, e sotto una chiave senza
 * token: una foto già vista si rilegge senza che nessuno controlli più se chi
 * la chiede può ancora vederla. Finché l'utente è lo stesso è il suo scopo,
 * le foto offline. Dopo un'uscita, o fuori da una lista condivisa, no.
 *
 * Gira nella pagina, non nel service worker: la Cache API è la stessa. Prova
 * tutte le cancellazioni anche se una fallisce, poi rilancia il primo errore:
 * chi chiama decide che farne, e di solito non deve fermarsi.
 */
export async function clearSignedImageCaches(): Promise<void> {
  if (typeof caches === 'undefined') return

  const results = await Promise.allSettled(
    [SIGNED_IMAGE_CACHE, ...OBSOLETE_IMAGE_CACHES].map((name) => caches.delete(name))
  )
  const failure = results.find((result) => result.status === 'rejected')
  if (failure) throw failure.reason
}
