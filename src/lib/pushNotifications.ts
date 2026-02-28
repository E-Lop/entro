import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const PUSH_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-push`

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

async function callPushApi(body: Record<string, unknown>): Promise<Response> {
  console.log('[push] callPushApi start', body.action)
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) throw new Error('Not authenticated')

  const response = await fetch(PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  console.log('[push] callPushApi done', response.status)
  return response
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as { standalone?: boolean }).standalone === true
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function getPermissionState(): NotificationPermission {
  if (!isPushSupported()) return 'denied'
  return Notification.permission
}

async function waitForServiceWorker(timeoutMs = 10000): Promise<ServiceWorkerRegistration> {
  console.log('[push] waitForServiceWorker start, timeout:', timeoutMs)
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
  if (!registration) {
    console.error('[push] SW timeout after', timeoutMs, 'ms')
    throw new Error('Service worker non pronto. Ricarica la pagina e riprova.')
  }
  console.log('[push] SW ready')
  return registration
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const registration = await waitForServiceWorker(3000)
    const sub = await registration.pushManager.getSubscription()
    console.log('[push] getCurrentSubscription:', sub ? 'found' : 'none')
    return sub
  } catch {
    console.log('[push] getCurrentSubscription: SW not ready')
    return null
  }
}

export async function subscribeToPush(): Promise<{
  success: boolean; subscription?: PushSubscription; error?: string
}> {
  try {
    console.log('[push] subscribeToPush start')
    console.log('[push] VAPID_PUBLIC_KEY defined:', !!VAPID_PUBLIC_KEY)
    console.log('[push] PUSH_ENDPOINT:', PUSH_ENDPOINT)

    if (!isPushSupported()) return { success: false, error: 'Push notifications not supported' }

    if (isIOS() && !isPWAInstalled()) {
      return { success: false, error: "Su iOS, aggiungi l'app alla Schermata Home per ricevere notifiche" }
    }

    console.log('[push] requesting permission...')
    const permission = await Notification.requestPermission()
    console.log('[push] permission:', permission)
    if (permission !== 'granted') return { success: false, error: 'Permesso notifiche negato' }

    const registration = await waitForServiceWorker()
    console.log('[push] pushManager.subscribe...')
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
    console.log('[push] subscription obtained:', subscription.endpoint.slice(0, 50))

    const response = await callPushApi({
      action: 'subscribe',
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[push] server error:', response.status, text)
      throw new Error('Failed to register subscription on server')
    }
    console.log('[push] subscribe SUCCESS')
    return { success: true, subscription }
  } catch (error) {
    console.error('[push] Subscribe error:', error)
    return { success: false, error: formatError(error) }
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[push] unsubscribeFromPush start')
    const subscription = await getCurrentSubscription()
    if (!subscription) {
      console.log('[push] no subscription found, nothing to unsubscribe')
      return { success: true }
    }

    console.log('[push] calling unsubscribe API...')
    await callPushApi({ action: 'unsubscribe', endpoint: subscription.endpoint }).catch(() => {})
    console.log('[push] calling subscription.unsubscribe()...')
    await subscription.unsubscribe()
    console.log('[push] unsubscribe SUCCESS')
    return { success: true }
  } catch (error) {
    console.error('[push] Unsubscribe error:', error)
    return { success: false, error: formatError(error) }
  }
}
