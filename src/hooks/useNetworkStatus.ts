import { useEffect, useState } from 'react'

/**
 * Hook to detect online/offline network status
 * Useful for triggering reconnection when network is restored
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Back online')
      setIsOnline(true)
    }

    const handleOffline = () => {
      console.log('[Network] Gone offline')
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
