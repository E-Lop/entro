import { useState, type ReactNode } from 'react'
import { Bell, BellRing, X } from 'lucide-react'
import { Button } from '../ui/button'
import { usePushSubscription } from '@/hooks/usePushSubscription'

const DISMISSED_KEY = 'entro_notification_prompt_dismissed'

const MIN_FOODS_FOR_PROMPT = 3

interface NotificationPromptProps {
  foodCount: number
}

export function NotificationPrompt({ foodCount }: NotificationPromptProps) {
  const { status, subscribe, isLoading } = usePushSubscription()
  // First-time opt-in: permanently dismissible (localStorage).
  const [upsellDismissed, setUpsellDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true'
  )
  // Lost subscription: a malfunction, so only dismissible for the session
  // (in-memory) — it must resurface on the next visit until actually fixed.
  const [lostDismissed, setLostDismissed] = useState(false)

  const pending = isLoading || status === 'loading'

  // Subscription silently lost (e.g. iOS invalidation): nudge to re-enable.
  // Shown regardless of foodCount and independent of the upsell dismissal.
  if (status === 'lost' && !lostDismissed) {
    return (
      <PromptBanner
        tone="warning"
        icon={<BellRing className="h-5 w-5 text-warning mt-0.5 shrink-0" />}
        message="Le notifiche si sono disattivate. Riattivale per non perdere le scadenze."
        onDismiss={() => setLostDismissed(true)}
      >
        <Button size="touch" onClick={() => subscribe()} disabled={pending}>
          {pending ? 'Attivazione...' : 'Riattiva'}
        </Button>
      </PromptBanner>
    )
  }

  // First-time opt-in: only once the user has enough foods to care about.
  if (status === 'prompt' && !upsellDismissed && foodCount >= MIN_FOODS_FOR_PROMPT) {
    const dismiss = (): void => {
      localStorage.setItem(DISMISSED_KEY, 'true')
      setUpsellDismissed(true)
    }
    const activate = async (): Promise<void> => {
      await subscribe()
      // Hide regardless of outcome -- on denial the settings page shows the status.
      dismiss()
    }
    return (
      <PromptBanner
        tone="primary"
        icon={<Bell className="h-5 w-5 text-primary mt-0.5 shrink-0" />}
        message="Vuoi ricevere notifiche quando i tuoi alimenti stanno per scadere?"
        onDismiss={dismiss}
      >
        <Button size="touch" onClick={activate} disabled={pending}>
          {pending ? 'Attivazione...' : 'Attiva'}
        </Button>
        <Button size="touch" variant="ghost" onClick={dismiss}>
          Non ora
        </Button>
      </PromptBanner>
    )
  }

  return null
}

interface PromptBannerProps {
  tone: 'primary' | 'warning'
  icon: ReactNode
  message: string
  onDismiss: () => void
  children: ReactNode
}

function PromptBanner({ tone, icon, message, onDismiss, children }: PromptBannerProps) {
  const toneClass = tone === 'warning'
    ? 'bg-warning/10 border-warning/30'
    : 'bg-primary/5 border-primary/20'
  return (
    <div className={`relative flex items-start gap-3 p-4 border rounded-lg ${toneClass}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{message}</p>
        <div className="flex gap-2 mt-3">{children}</div>
      </div>
      <button
        onClick={onDismiss}
        className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label="Chiudi"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
