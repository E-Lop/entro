/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { resubscribeOnChange } from './lib/pushResubscribe'

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

// Supabase Storage signed image URLs contain a unique token in the query string.
// We strip the query params so the same image always hits the same cache entry,
// regardless of which signed URL was generated.
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/sign\/.*/i,
  new CacheFirst({
    cacheName: 'supabase-images-cache',
    plugins: [
      {
        cacheKeyWillBeUsed: async ({ request }) => {
          const url = new URL(request.url)
          url.search = ''
          return url.href
        },
      },
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

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
