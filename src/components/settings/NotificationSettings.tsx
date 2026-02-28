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

function getToggleButtonLabel(isLoading: boolean, isSubscribed: boolean): string {
  if (isLoading) return 'Caricamento...'
  if (isSubscribed) return 'Disattiva'
  return 'Attiva'
}

export function NotificationSettings() {
  const { status, isLoading, subscribe, unsubscribe } = usePushSubscription()
  const { data: prefs } = useNotificationPreferences()
  const updatePrefs = useUpdateNotificationPreferences()

  const isSubscribed = status === 'subscribed'
  const showToggle = status === 'prompt' || status === 'subscribed' || status === 'loading'

  function handleIntervalToggle(interval: number): void {
    if (!prefs) return
    const current = prefs.expiry_intervals
    const updated = current.includes(interval)
      ? current.filter((i) => i !== interval)
      : [...current, interval].sort((a, b) => b - a)
    if (updated.length > 0) {
      updatePrefs.mutate({ expiry_intervals: updated })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <CardTitle>Notifiche</CardTitle>
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
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <Smartphone className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Installa l'app per le notifiche
              </p>
              <p className="text-amber-700 dark:text-amber-300 mt-1">
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
              <p className="text-sm text-muted-foreground">
                {isSubscribed ? 'Riceverai avvisi sulle scadenze' : 'Attiva per ricevere avvisi'}
              </p>
            </div>
            <Button
              variant={isSubscribed ? 'outline' : 'default'}
              size="sm"
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={isLoading || status === 'loading'}
            >
              {getToggleButtonLabel(isLoading, isSubscribed)}
            </Button>
          </div>
        )}

        {isSubscribed && prefs && (
          <div className="border-t pt-4 space-y-4">
            <div>
              <p className="font-medium text-sm mb-2">Quando avvisarti</p>
              <div className="space-y-2">
                {INTERVAL_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prefs.expiry_intervals.includes(value)}
                      onChange={() => handleIntervalToggle(value)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={prefs.quiet_hours_enabled}
                  onChange={(e) => updatePrefs.mutate({ quiet_hours_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Ore silenziose</span>
              </label>
              {prefs.quiet_hours_enabled && (
                <div className="flex items-center gap-2 ml-7">
                  <select
                    value={prefs.quiet_hours_start}
                    onChange={(e) => updatePrefs.mutate({ quiet_hours_start: Number(e.target.value) })}
                    className="text-sm border rounded px-2 py-1 bg-background"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                  <span className="text-sm text-muted-foreground">-</span>
                  <select
                    value={prefs.quiet_hours_end}
                    onChange={(e) => updatePrefs.mutate({ quiet_hours_end: Number(e.target.value) })}
                    className="text-sm border rounded px-2 py-1 bg-background"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Notifiche max al giorno</span>
              <select
                value={prefs.max_notifications_per_day}
                onChange={(e) => updatePrefs.mutate({ max_notifications_per_day: Number(e.target.value) })}
                className="text-sm border rounded px-2 py-1 bg-background"
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
