import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  isPushSupported, isPWAInstalled, isIOS, getPermissionState,
  getCurrentSubscription, subscribeToPush, unsubscribeFromPush,
} from '@/lib/pushNotifications'

export type PushStatus = 'unsupported' | 'ios-not-installed' | 'prompt' | 'subscribed' | 'denied' | 'loading'

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function checkStatus(): Promise<void> {
      try {
        if (!isPushSupported()) {
          setStatus('unsupported')
          return
        }
        if (isIOS() && !isPWAInstalled()) {
          setStatus('ios-not-installed')
          return
        }
        if (getPermissionState() === 'denied') {
          setStatus('denied')
          return
        }
        const subscription = await getCurrentSubscription()
        setStatus(subscription ? 'subscribed' : 'prompt')
      } catch (error) {
        console.error('[usePushSubscription] checkStatus error:', error)
        setStatus('prompt')
      }
    }
    checkStatus()
  }, [])

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
    setIsLoading(true)
    const result = await subscribeToPush()
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
    setIsLoading(true)
    const result = await unsubscribeFromPush()
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
