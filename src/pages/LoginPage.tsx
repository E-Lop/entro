import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthForm } from '../components/auth/AuthForm'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../hooks/useAuth'
import { validateInvite, acceptInvite } from '../lib/invites'
import { Loader2 } from 'lucide-react'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, loading } = useAuth()

  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteValid, setInviteValid] = useState<boolean>(false)
  const [inviteLoading, setInviteLoading] = useState<boolean>(false)
  const [inviteListName, setInviteListName] = useState<string>('')

  // Validate invite token if present in URL
  useEffect(() => {
    const token = searchParams.get('invite_token')
    if (token) {
      setInviteToken(token)
      setInviteLoading(true)

      validateInvite(token)
        .then(({ valid, invite, error }) => {
          if (valid && invite) {
            setInviteValid(true)
            setInviteListName(invite.listName || 'una lista condivisa')
          } else {
            toast.error(
              error?.message || 'L\'invito potrebbe essere scaduto o già utilizzato'
            )
          }
        })
        .catch(() => {
          toast.error('Impossibile verificare l\'invito')
        })
        .finally(() => {
          setInviteLoading(false)
        })
    }
  }, [searchParams])

  // Redirect to home if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  const handleSuccess = async () => {
    // If there's a valid invite token, accept it before navigating
    if (inviteToken && inviteValid) {
      const { success, error } = await acceptInvite(inviteToken)

      if (success) {
        toast.success(`Ti sei unito con successo a "${inviteListName}"`)
      } else {
        toast.warning(
          error?.message || 'Impossibile accettare l\'invito, ma hai effettuato l\'accesso'
        )
      }
    }

    navigate('/', { replace: true })
  }

  // Show loading or nothing while checking auth status
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-slate-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Accedi a entro
          </CardTitle>
          <CardDescription className="text-center">
            {inviteLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifica invito...
              </span>
            ) : inviteValid ? (
              <span className="text-primary font-medium">
                Sei stato invitato a "{inviteListName}"! Accedi per unirti.
              </span>
            ) : (
              'Inserisci le tue credenziali per accedere'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="login" onSuccess={handleSuccess} />
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-slate-600">
            Non hai un account?{' '}
            <Link
              to={inviteToken ? `/signup?invite_token=${inviteToken}` : '/signup'}
              className="font-medium text-primary hover:underline"
            >
              Registrati
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
export default LoginPage
