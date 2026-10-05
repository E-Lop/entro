/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { resubscribeOnChange } from './lib/pushResubscribe'
import {
  OBSOLETE_IMAGE_CACHES,
  SIGNED_IMAGE_CACHE,
  SIGNED_IMAGE_CACHEABLE_STATUSES,
  isSignedImageUrl,
  signedImageCacheKey,
} from './lib/signedImageCache'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Runtime caching

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// Le foto degli alimenti: quali richieste, sotto che chiave e quali risposte
// lo decide `signedImageCache`, dove si può provare.
registerRoute(
  ({ url }) => isSignedImageUrl(url),
  new CacheFirst({
    cacheName: SIGNED_IMAGE_CACHE,
    plugins: [
      { cacheKeyWillBeUsed: async ({ request }) => signedImageCacheKey(request.url) },
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: SIGNED_IMAGE_CACHEABLE_STATUSES }),
    ],
  })
)

// Le voci della cache di prima non scadono da sole in tempo utile, e fra loro
// possono esserci risposte d'errore salvate al posto delle foto (#211).
// `cleanupOutdatedCaches` qui sopra guarda solo le precache.
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all(OBSOLETE_IMAGE_CACHES.map((name) => caches.delete(name))))
})

// SPA navigation fallback
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api/],
}))

// Push notification handlers

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: { url?: string; foodId?: string; type?: string }
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    payload = { title: 'entro', body: event.data.text() }
  }

  const options: NotificationOptions & Record<string, unknown> = {
    body: payload.body,
    icon: payload.icon ?? '/icons/icon-192x192.png',
    badge: payload.badge ?? '/icons/favicon-32x32.png',
    tag: payload.tag ?? 'entro-expiry',
    data: payload.data ?? { url: '/' },
    // `vibrate` è sperimentale e onorato solo su Android Chromium
    // (api.Notification.vibrate, verificato 2026-06-17); iOS/Firefox/Safari e
    // tutte le WebView lo ignorano — iOS suona il proprio haptic di notifica.
    // Innocuo dove non supportato.
    vibrate: [100, 50, 200],
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existingClient = windowClients[0]
      if (existingClient) {
        existingClient.focus()
        existingClient.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen })
        return
      }
      return self.clients.openWindow(urlToOpen)
    })
  )
})

// Quando il browser rinnova/revoca la subscription, ri-sottoscrive nel SW e
// notifica i client (pattern canonico MDN), senza dipendere da una finestra
// aperta. NB: iOS Safari NON emette mai questo evento (BCD safari_ios=false,
// verificato 2026-06-26) → su iPhone il recupero avviene dal nudge in-app.
self.addEventListener('pushsubscriptionchange', (event: Event) => {
  const pushEvent = event as ExtendableEvent & {
    oldSubscription?: PushSubscription
    newSubscription?: PushSubscription
  }
  pushEvent.waitUntil(
    resubscribeOnChange(
      self.registration.pushManager,
      pushEvent,
      self.clients,
      import.meta.env.VITE_VAPID_PUBLIC_KEY,
    )
  )
})
