import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  isPushSupported, isPWAInstalled, isIOS, getPermissionState,
  getCurrentSubscription, subscribeToPush, unsubscribeFromPush,
} from '@/lib/pushNotifications'

export type PushStatus = 'unsupported' | 'ios-not-installed' | 'prompt' | 'subscribed' | 'denied' | 'loading'

function getInitialStatus(): PushStatus {
  if (!isPushSupported()) { console.log('[pushHook] unsupported'); return 'unsupported' }
  if (isIOS() && !isPWAInstalled()) { console.log('[pushHook] ios-not-installed'); return 'ios-not-installed' }
  const permission = getPermissionState()
  console.log('[pushHook] permission:', permission)
  if (permission === 'denied') return 'denied'
  if (permission === 'granted') return 'subscribed'
  return 'prompt'
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>(getInitialStatus)
  const [isLoading, setIsLoading] = useState(false)

  // Refine status by checking actual subscription (async, non-blocking)
  useEffect(() => {
    if (status !== 'subscribed') return
    let cancelled = false
    getCurrentSubscription().then((sub) => {
      if (!cancelled && !sub) setStatus('prompt')
    }).catch(() => {
      // If we can't check, keep showing 'subscribed' since permission is granted
    })
    return () => { cancelled = true }
  }, [status])

  useEffect(() => {
    function handleSwMessage(event: MessageEvent): void {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        subscribeToPush().then((result) => {
          if (result.success) setStatus('subscribed')
        })
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
  }, [])

  const subscribe = useCallback(async () => {
    console.log('[pushHook] subscribe clicked')
    setIsLoading(true)
    const result = await subscribeToPush()
    console.log('[pushHook] subscribe result:', result)
    setIsLoading(false)

    if (result.success) {
      setStatus('subscribed')
      toast.success('Notifiche attivate!')
      return
    }

    const error = result.error ?? "Errore nell'attivazione delle notifiche"

    if (error.includes('Schermata Home')) {
      setStatus('ios-not-installed')
      toast.info(error, { duration: 6000 })
    } else if (error.includes('negato')) {
      setStatus('denied')
      toast.error('Permesso negato. Puoi riabilitarlo dalle impostazioni del browser.')
    } else {
      toast.error(error)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    console.log('[pushHook] unsubscribe clicked')
    setIsLoading(true)
    const result = await unsubscribeFromPush()
    console.log('[pushHook] unsubscribe result:', result)
    setIsLoading(false)

    if (result.success) {
      setStatus('prompt')
      toast.success('Notifiche disattivate')
    } else {
      toast.error('Errore nella disattivazione delle notifiche')
    }
  }, [])

  return { status, isLoading, subscribe, unsubscribe }
}
