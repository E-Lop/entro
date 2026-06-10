import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { usePendingMutationsCount } from '@/hooks/usePendingMutations'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const pendingCount = usePendingMutationsCount()

  if (isOnline && pendingCount === 0) return null

  if (isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-md"
      >
        <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span>Sincronizzazione in corso... ({pendingCount})</span>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-md"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      <span>
        Sei offline
        {pendingCount > 0
          ? ` - ${pendingCount} modifiche in attesa di sincronizzazione`
          : ' - i tuoi dati sono disponibili dalla cache'}
      </span>
    </div>
  )
}
