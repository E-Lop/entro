import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '../ui/button'
import { isPushSupported, getPermissionState } from '@/lib/pushNotifications'
import { usePushSubscription } from '@/hooks/usePushSubscription'

const DISMISSED_KEY = 'entro_notification_prompt_dismissed'

const MIN_FOODS_FOR_PROMPT = 3

interface NotificationPromptProps {
  foodCount: number
}

export function NotificationPrompt({ foodCount }: NotificationPromptProps) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true'
  )
  const { status, subscribe, isLoading } = usePushSubscription()

  const shouldHide = dismissed
    || !isPushSupported()
    || getPermissionState() !== 'default'
    || foodCount < MIN_FOODS_FOR_PROMPT

  if (shouldHide) return null

  function dismiss(): void {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setDismissed(true)
  }

  async function handleActivate(): Promise<void> {
    await subscribe()
    // Hide the prompt regardless of outcome -- on denial the settings page will show the status
    dismiss()
  }

  return (
    <div className="relative flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
      <Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          Vuoi ricevere notifiche quando i tuoi alimenti stanno per scadere?
        </p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={handleActivate} disabled={isLoading || status === 'loading'}>
            {isLoading ? 'Attivazione...' : 'Attiva'}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Non ora
          </Button>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Chiudi"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
