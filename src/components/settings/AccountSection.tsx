import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { useAuth } from '../../hooks/useAuth'
import { User, Mail } from 'lucide-react'

/**
 * Account Section Component
 * Displays user profile information (email, full name)
 */
export function AccountSection() {
  const { user } = useAuth()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profilo</CardTitle>
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
      </CardContent>
    </Card>
  )
}
