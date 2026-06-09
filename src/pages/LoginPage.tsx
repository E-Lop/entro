import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthForm } from '../components/auth/AuthForm'
import { AuthLoadingScreen } from '../components/auth/AuthLoadingScreen'
import { Footer } from '../components/layout/Footer'
import { useAuth } from '../hooks/useAuth'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { validateInvite, acceptInvite } from '../lib/invites'
import { Loader2 } from 'lucide-react'

export function LoginPage() {
  useDocumentMeta('Accedi')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, loading } = useAuth()

  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [inviteValid, setInviteValid] = useState<boolean>(false)
  const [inviteLoading, setInviteLoading] = useState<boolean>(false)
  const [inviteCreatorName, setInviteCreatorName] = useState<string>('')

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
            setInviteCreatorName(invite.creatorName || 'un utente')
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
        toast.success(`Ti sei unito con successo alla lista di ${inviteCreatorName}!`)
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
    return <AuthLoadingScreen />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Accedi a entro</h1>
            <p className="mt-2 text-muted-foreground">
              {inviteLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifica invito...
                </span>
              ) : inviteValid ? (
                <span className="text-primary font-medium">
                  {inviteCreatorName} ti ha invitato a condividere la sua lista! Accedi per unirti.
                </span>
              ) : (
                'Inserisci le tue credenziali per accedere'
              )}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <AuthForm mode="login" onSuccess={handleSuccess} />
          </div>

          <div className="space-y-2 text-center text-sm text-muted-foreground">
            <div>
              Non hai un account?{' '}
              <Link
                to={inviteToken ? `/signup?invite_token=${inviteToken}` : '/signup'}
                className="font-medium text-primary hover:underline"
              >
                Registrati
              </Link>
            </div>
            <div>
              <Link
                to="/forgot-password"
                className="font-medium text-muted-foreground hover:text-primary hover:underline"
              >
                Password dimenticata?
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
export default LoginPage
