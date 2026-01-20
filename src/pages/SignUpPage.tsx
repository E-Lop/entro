import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthForm } from '../components/auth/AuthForm'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../hooks/useAuth'
import { validateInvite, acceptInvite } from '../lib/invites'
import { Loader2 } from 'lucide-react'

export function SignUpPage() {
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
    try {
      if (inviteToken && inviteValid) {
        // User signed up with invite - accept the invite
        const { success, error } = await acceptInvite(inviteToken)

        if (success) {
          toast.success(`Ti sei unito con successo a "${inviteListName}"`)
        } else {
          toast.warning(
            error?.message || 'Impossibile accettare l\'invito, ma il tuo account è stato creato'
          )
        }
      } else {
        // User signed up without invite - create personal list
        const { createPersonalList } = await import('../lib/invites')
        const { success, error } = await createPersonalList()

        if (!success) {
          console.error('Failed to create personal list:', error)
          toast.warning('Account creato. Lista personale verrà creata al primo accesso.')
        }
      }
    } catch (error) {
      console.error('Post-signup error:', error)
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
            Crea il tuo account
          </CardTitle>
          <CardDescription className="text-center">
            {inviteLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifica invito...
              </span>
            ) : inviteValid ? (
              <span className="text-primary font-medium">
                Sei stato invitato a "{inviteListName}"! Crea il tuo account per unirti.
              </span>
            ) : (
              'Inizia a tracciare le scadenze dei tuoi alimenti'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="signup" onSuccess={handleSuccess} />
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-slate-600">
            Hai già un account?{' '}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Accedi
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
export default SignUpPage
