import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Bell, BellOff, Smartphone } from 'lucide-react'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/useNotificationPreferences'

const INTERVAL_OPTIONS = [
  { value: 7, label: '7 giorni prima' },
  { value: 3, label: '3 giorni prima' },
  { value: 2, label: '2 giorni prima' },
  { value: 1, label: '1 giorno prima' },
  { value: 0, label: 'Giorno della scadenza' },
] as const

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MAX_DAILY_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

const SELECT_CLASS = 'h-11 text-sm border border-input rounded-md px-2 bg-background'
const CHECKBOX_CLASS = 'h-5 w-5 rounded border-input text-primary focus:ring-primary'

function getToggleButtonLabel(isLoading: boolean, isSubscribed: boolean): string {
  if (isLoading) return isSubscribed ? 'Disattivazione...' : 'Attivazione...'
  if (isSubscribed) return 'Disattiva'
  return 'Attiva'
}

export function NotificationSettings() {
  const { status, isLoading, subscribe, unsubscribe } = usePushSubscription()
  const { data: prefs } = useNotificationPreferences()
  const updatePrefs = useUpdateNotificationPreferences()
  const [showMinIntervalHint, setShowMinIntervalHint] = useState(false)

  const isSubscribed = status === 'subscribed'
  const showToggle = status === 'prompt' || status === 'subscribed' || status === 'loading'

  function handleIntervalToggle(interval: number): void {
    if (!prefs) return
    const current = prefs.expiry_intervals
    const updated = current.includes(interval)
      ? current.filter((i) => i !== interval)
      : [...current, interval].sort((a, b) => b - a)
    if (updated.length === 0) {
      // Deve restare attivo almeno un intervallo: spiega invece di ignorare il tap
      setShowMinIntervalHint(true)
      return
    }
    setShowMinIntervalHint(false)
    updatePrefs.mutate({ expiry_intervals: updated })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle as="h2">Notifiche</CardTitle>
        </div>
        <CardDescription>
          Ricevi avvisi quando i tuoi alimenti stanno per scadere
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'unsupported' && (
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <BellOff className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Il tuo browser non supporta le notifiche push.
            </p>
          </div>
        )}

        {status === 'ios-not-installed' && (
          <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <Smartphone className="h-5 w-5 text-warning mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-warning">
                Installa l'app per le notifiche
              </p>
              <p className="text-warning/90 mt-1">
                Su iOS, tocca il pulsante Condividi <span className="inline-block">&#x2191;</span> e seleziona "Aggiungi alla schermata Home".
              </p>
            </div>
          </div>
        )}

        {status === 'denied' && (
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
            <BellOff className="h-5 w-5 text-destructive mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Permesso notifiche negato. Puoi riabilitarlo dalle impostazioni del tuo browser.
            </p>
          </div>
        )}

        {showToggle && (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Notifiche push</p>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {isSubscribed ? 'Riceverai avvisi sulle scadenze' : 'Attiva per ricevere avvisi'}
              </p>
            </div>
            <Button
              variant={isSubscribed ? 'outline' : 'default'}
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={isLoading || status === 'loading'}
              aria-pressed={isSubscribed}
              className="h-11"
            >
              {getToggleButtonLabel(isLoading, isSubscribed)}
            </Button>
          </div>
        )}

        {isSubscribed && prefs && (
          <div className="border-t pt-4 space-y-4">
            <div>
              <p className="font-medium text-sm mb-2">Quando avvisarti</p>
              <div className="space-y-1">
                {INTERVAL_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-3 cursor-pointer min-h-11">
                    <input
                      type="checkbox"
                      checked={prefs.expiry_intervals.includes(value)}
                      onChange={() => handleIntervalToggle(value)}
                      className={CHECKBOX_CLASS}
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
              {showMinIntervalHint && (
                <p role="status" aria-live="polite" className="text-sm text-warning mt-1">
                  Mantieni almeno un intervallo di avviso attivo.
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer min-h-11">
                <input
                  type="checkbox"
                  checked={prefs.quiet_hours_enabled}
                  onChange={(e) => updatePrefs.mutate({ quiet_hours_enabled: e.target.checked })}
                  className={CHECKBOX_CLASS}
                />
                <span className="text-sm font-medium">Ore silenziose</span>
              </label>
              {prefs.quiet_hours_enabled && (
                <div className="flex items-center gap-2 ml-8 mt-1">
                  <select
                    value={prefs.quiet_hours_start}
                    onChange={(e) => updatePrefs.mutate({ quiet_hours_start: Number(e.target.value) })}
                    aria-label="Inizio ore silenziose"
                    className={SELECT_CLASS}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                  <span className="text-sm text-muted-foreground">-</span>
                  <select
                    value={prefs.quiet_hours_end}
                    onChange={(e) => updatePrefs.mutate({ quiet_hours_end: Number(e.target.value) })}
                    aria-label="Fine ore silenziose"
                    className={SELECT_CLASS}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="max-notifications-per-day" className="text-sm font-medium">
                Notifiche max al giorno
              </label>
              <select
                id="max-notifications-per-day"
                value={prefs.max_notifications_per_day}
                onChange={(e) => updatePrefs.mutate({ max_notifications_per_day: Number(e.target.value) })}
                className={SELECT_CLASS}
              >
                {MAX_DAILY_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
