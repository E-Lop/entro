import { useState } from 'react'
import { Smartphone } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { isHapticsSupported, isHapticsEnabled, setHapticsEnabled, triggerHaptic } from '@/lib/haptics'

export function HapticSettings() {
  const [enabled, setEnabled] = useState(isHapticsEnabled)

  if (!isHapticsSupported()) return null

  const handleToggle = () => {
    const next = !enabled
    setHapticsEnabled(next)
    setEnabled(next)
    if (next) {
      triggerHaptic('success')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <CardTitle>Feedback Aptico</CardTitle>
        </div>
        <CardDescription>
          Vibrazione tattile durante le interazioni principali
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Vibrazione</p>
            <p className="text-sm text-muted-foreground">
              {enabled ? 'Feedback aptico attivo' : 'Feedback aptico disattivato'}
            </p>
          </div>
          <Button
            variant={enabled ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggle}
          >
            {enabled ? 'Disattiva' : 'Attiva'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
