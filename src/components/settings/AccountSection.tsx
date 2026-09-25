import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { useAuth } from '../../hooks/useAuth'
import { signOutOtherDevices } from '@/lib/auth'
import { User, Mail, MonitorSmartphone } from 'lucide-react'

/**
 * Account Section Component
 * Displays user profile information (email, full name)
 */
export function AccountSection() {
  const { user } = useAuth()
  const [signingOutOthers, setSigningOutOthers] = useState(false)

  // Nessuna conferma prima: non cancella dati, e al peggio si rientra con la
  // password (#143, deciso il 22 set 2026).
  const handleSignOutOthers = async () => {
    setSigningOutOthers(true)
    const { error } = await signOutOtherDevices()
    setSigningOutOthers(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Accesso chiuso sugli altri dispositivi')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Profilo</CardTitle>
        <CardDescription>Informazioni del tuo account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="text-sm">{user?.email || 'N/A'}</p>
          </div>
        </div>

        {/* Full Name */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <User className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Nome</p>
            <p className="text-sm">{user?.user_metadata?.full_name || 'N/A'}</p>
          </div>
        </div>

        {/* Dispositivi */}
        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
          <MonitorSmartphone className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Dispositivi</p>
            <Button
              variant="outline"
              // 44 px: la soglia del bersaglio della famiglia, anche sul web
              // (entro-family `conventions/touch-target-and-link-semantics.md`).
              className="h-11"
              onClick={handleSignOutOthers}
              disabled={signingOutOthers}
            >
              {signingOutOthers ? 'Uscita in corso…' : 'Esci dagli altri dispositivi'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Chiude l'accesso a entro su tutti gli altri telefoni e browser. Su questo resti dentro.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
