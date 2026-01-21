import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthForm } from '../components/auth/AuthForm'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useAuth } from '../hooks/useAuth'
import { validateInvite, acceptInvite } from '../lib/invites'
import { Loader2 } from 'lucide-react'

export function SignUpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, loading } = useAuth()

  // Solo short code
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteValid, setInviteValid] = useState<boolean>(false)
  const [inviteLoading, setInviteLoading] = useState<boolean>(false)
  const [inviteCreatorName, setInviteCreatorName] = useState<string>('')

  // Input manuale
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')

    if (code) {
      setInviteCode(code.toUpperCase())
      setInviteLoading(true)
      validateInvite(code)
        .then(({ valid, invite, error }) => {
          if (valid && invite) {
            setInviteValid(true)
            setInviteCreatorName(invite.creatorName || 'un utente')
            // NO email prefill
          } else {
            toast.error(error?.message || 'Codice non valido')
          }
        })
        .finally(() => setInviteLoading(false))
    }
  }, [searchParams])

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  const handleManualCodeSubmit = async () => {
    if (!manualCode || manualCode.length !== 6) {
      toast.error('Inserisci un codice valido (6 caratteri)')
      return
    }

    setInviteLoading(true)
    const { valid, invite, error } = await validateInvite(manualCode)

    if (valid && invite) {
      setInviteCode(manualCode.toUpperCase())
      setInviteValid(true)
      setInviteCreatorName(invite.creatorName || 'un utente')
      setShowCodeInput(false)
    } else {
      toast.error(error?.message || 'Codice non valido')
    }
    setInviteLoading(false)
  }

  const handleSuccess = async () => {
    try {
      if (inviteCode && inviteValid) {
        // Call acceptInvite con short code
        const { success, error } = await acceptInvite(inviteCode)

        if (!success) {
          console.error('Failed to accept invite:', error)
        }

        toast.info(
          'Registrazione completata! Controlla la tua email e clicca sul link di conferma per unirti alla lista condivisa.',
          { duration: 12000 }
        )
      } else {
        // Signup senza invito - crea lista personale
        const { createPersonalList } = await import('../lib/invites')
        const { success, error } = await createPersonalList()

        if (!success) {
          console.error('Failed to create personal list:', error)
        }

        toast.success(
          'Registrazione completata! Controlla la tua email per confermare l\'account.',
          { duration: 10000 }
        )
      }
    } catch (error) {
      console.error('Post-signup error:', error)
    }
  }

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
                {inviteCreatorName} ti ha invitato a condividere la sua lista!
              </span>
            ) : (
              'Inizia a tracciare le scadenze dei tuoi alimenti'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Input codice manuale */}
          {!inviteValid && !inviteCode && (
            <div className="mb-4">
              {!showCodeInput ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCodeInput(true)}
                >
                  Ho un codice invito
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label>Codice invito</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="ABC123"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="font-mono text-lg tracking-wider"
                    />
                    <Button onClick={handleManualCodeSubmit} disabled={inviteLoading}>
                      {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verifica'}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCodeInput(false)}
                    className="w-full"
                  >
                    Annulla
                  </Button>
                </div>
              )}
            </div>
          )}

          <AuthForm
            mode="signup"
            onSuccess={handleSuccess}
            // NO prefillEmail, NO lockEmail
          />
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
