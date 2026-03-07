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
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) throw new Error('Not authenticated')

  return fetch(PUSH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(body),
  })
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

/**
 * Attende che il service worker sia pronto, con timeout.
 * Ritorna la ServiceWorkerRegistration attiva o lancia errore
 * se il SW non si attiva entro il timeout specificato.
 *
 * @param timeoutMs - Tempo massimo di attesa in ms (default: 10000)
 * @throws Error se il service worker non è pronto entro il timeout
 */
async function waitForServiceWorker(timeoutMs = 10000): Promise<ServiceWorkerRegistration> {
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ])
  if (!registration) {
    throw new Error('Service worker non pronto. Ricarica la pagina e riprova.')
  }
  return registration
}

/**
 * Ottiene la push subscription corrente dal browser, se esiste.
 * Usa un timeout ridotto (3s) perché il SW dovrebbe già essere attivo.
 * Ritorna null in caso di qualsiasi errore (non supportato, SW non pronto,
 * nessuna subscription esistente).
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const registration = await waitForServiceWorker(3000)
    return registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * Sottoscrive l'utente alle push notifications.
 *
 * Guard (ritorna errore senza procedere):
 * 1. Push API non supportata dal browser
 * 2. iOS senza installazione PWA (Push richiede Home Screen)
 * 3. Dispositivo offline (registrazione server fallirebbe)
 * 4. Utente nega il permesso di notifica
 * 5. Service worker non pronto entro 10s di timeout
 *
 * In caso di successo, registra la subscription sul server via Edge Function.
 * Se la registrazione server fallisce, esegue ROLLBACK: rimuove la
 * PushSubscription locale per evitare stato inconsistente (browser pensa
 * di essere iscritto, ma il server non ha record).
 *
 * @returns Oggetto con success, subscription (se ok), o messaggio errore
 */
export async function subscribeToPush(): Promise<{
  success: boolean; subscription?: PushSubscription; error?: string
}> {
  try {
    if (!isPushSupported()) return { success: false, error: 'Push notifications not supported' }

    if (isIOS() && !isPWAInstalled()) {
      return { success: false, error: "Su iOS, aggiungi l'app alla Schermata Home per ricevere notifiche" }
    }

    if (!navigator.onLine) {
      return { success: false, error: 'Connessione internet necessaria per attivare le notifiche. Riprova quando sei online.' }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { success: false, error: 'Permesso notifiche negato' }

    const registration = await waitForServiceWorker()
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const response = await callPushApi({
      action: 'subscribe',
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    })

    if (!response.ok) {
      // Rollback local subscription to avoid inconsistent state
      await subscription.unsubscribe().catch(() => {})
      throw new Error('Failed to register subscription on server')
    }
    return { success: true, subscription }
  } catch (error) {
    console.error('[pushNotifications] Subscribe error:', error)
    return { success: false, error: formatError(error) }
  }
}

/**
 * Sincronizza la push subscription locale con il server.
 * Chiamata al caricamento dell'app per assicurare che il server abbia
 * i dati di subscription aggiornati (es. dopo rigenerazione chiavi VAPID
 * o cambio endpoint da pushsubscriptionchange nel SW).
 *
 * Scenari:
 * 1. Nessuna subscription locale → ritorna subito (niente da sincronizzare)
 * 2. Chiamata server ok → subscription sincronizzata
 * 3. Chiamata server fallisce → fallimento silenzioso, riprova al prossimo load
 *
 * Non lancia mai errori e non mostra messaggi all'utente.
 */
export async function syncSubscription(): Promise<void> {
  try {
    const subscription = await getCurrentSubscription()
    if (!subscription) return

    await callPushApi({
      action: 'subscribe',
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    })
  } catch {
    // Silent failure — sync will retry on next app load
  }
}

/**
 * Rimuove la sottoscrizione alle push notifications.
 * Rimuove la subscription dal server (best-effort, ignora errori server)
 * poi rimuove localmente via Push API.
 * Ritorna success anche se non esiste subscription (idempotente).
 */
export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const subscription = await getCurrentSubscription()
    if (!subscription) return { success: true }

    await callPushApi({ action: 'unsubscribe', endpoint: subscription.endpoint }).catch(() => {})
    await subscription.unsubscribe()
    return { success: true }
  } catch (error) {
    console.error('[pushNotifications] Unsubscribe error:', error)
    return { success: false, error: formatError(error) }
  }
}
