/**
 * Re-subscribe logic for the service worker `pushsubscriptionchange` event,
 * following the MDN canonical pattern: when the browser refreshes or revokes a
 * push subscription, re-subscribe from within the SW and notify open clients so
 * the server record gets updated — without depending on a window being open.
 *
 * Limitation: iOS Safari NEVER fires `pushsubscriptionchange`
 * (BCD `api.ServiceWorkerGlobalScope.pushsubscriptionchange_event`:
 * `safari_ios=false`, verified 2026-06-26), so this path only helps
 * Chrome/Firefox/desktop Safari. On iOS the subscription is recovered by the
 * in-app re-enable nudge (NotificationPrompt 'lost' state), not here.
 */

interface PushSubscriptionLike {
  options?: PushSubscriptionOptionsInit
  toJSON: () => unknown
}

interface SubscriptionChangeLike {
  oldSubscription?: PushSubscriptionLike | null
  newSubscription?: PushSubscriptionLike | null
}

interface PushManagerLike {
  subscribe: (options: PushSubscriptionOptionsInit) => Promise<PushSubscriptionLike>
}

interface ClientsLike {
  matchAll: (options: { type: 'window' }) => Promise<ReadonlyArray<{ postMessage: (message: unknown) => void }>>
}

export async function resubscribeOnChange(
  pushManager: PushManagerLike,
  event: SubscriptionChangeLike,
  clients: ClientsLike,
  fallbackApplicationServerKey?: PushSubscriptionOptionsInit['applicationServerKey'],
): Promise<void> {
  let subscription = event.newSubscription ?? null

  if (!subscription) {
    // Firefox doesn't populate oldSubscription, so fall back to the VAPID key.
    const options = event.oldSubscription?.options
      ?? (fallbackApplicationServerKey
        ? { userVisibleOnly: true, applicationServerKey: fallbackApplicationServerKey }
        : null)
    if (!options) return

    try {
      subscription = await pushManager.subscribe(options)
    } catch {
      // Degrade silently: the in-app syncSubscription() retries on next app open.
      return
    }
  }

  const subscriptionJson = subscription.toJSON()
  const windowClients = await clients.matchAll({ type: 'window' })
  for (const client of windowClients) {
    client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: subscriptionJson })
  }
}
