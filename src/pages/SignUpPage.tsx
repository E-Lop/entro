import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthForm } from '../components/auth/AuthForm'
import { AuthLoadingScreen } from '../components/auth/AuthLoadingScreen'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Footer } from '../components/layout/Footer'
import { useAuth } from '../hooks/useAuth'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { validateInvite, registerPendingInvite } from '../lib/invites'
import { Loader2 } from 'lucide-react'

function getSignUpDescription(
  inviteLoading: boolean,
  inviteValid: boolean,
  inviteCreatorName: string
): ReactNode {
  if (inviteLoading) {
    return (
      <span className="flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verifica invito...
      </span>
    )
  }
  if (inviteValid) {
    return (
      <span className="text-primary font-medium">
        {inviteCreatorName} ti ha invitato a condividere la sua lista!
      </span>
    )
  }
  return 'Inizia a tracciare le scadenze dei tuoi alimenti'
}

export function SignUpPage() {
  useDocumentMeta('Registrati')
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

  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false)

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

  const handleSuccess = async (email?: string) => {
    try {
      if (inviteCode && inviteValid && email) {
        // Register this email with the invite so it can be accepted after email confirmation
        const { success, error } = await registerPendingInvite(inviteCode, email)

        if (!success) {
          console.error('Failed to register pending invite:', error)
        }
      }

      // Save email in sessionStorage (secure, not exposed in URL)
      // and redirect to verify email page
      if (email) {
        sessionStorage.setItem('verify_email', email)
        navigate('/verify-email')
      }
    } catch (error) {
      console.error('Post-signup error:', error)
    }
  }

  if (loading) {
    return <AuthLoadingScreen />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Crea il tuo account</h1>
            <p className="mt-2 text-muted-foreground">
              {getSignUpDescription(inviteLoading, inviteValid, inviteCreatorName)}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6">
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
              disableSubmit={!termsAccepted}
              // NO prefillEmail, NO lockEmail
            />

            {/* Terms & Privacy Acceptance */}
            <div className="flex items-start gap-2 mt-4">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground">
                Accetto i{' '}
                <a
                  href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/condizioni-d'uso-del-sito-it"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Termini e Condizioni
                </a>{' '}
                e la{' '}
                <a
                  href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/privacy-policy-per-siti-web-o-e-commerce-it"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </label>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            Hai già un account?{' '}
            <Link
              to="/login"
              className="font-medium text-primary hover:underline"
            >
              Accedi
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default SignUpPage
