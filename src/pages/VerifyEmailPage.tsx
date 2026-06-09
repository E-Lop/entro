import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthLoadingScreen } from '../components/auth/AuthLoadingScreen'
import { Button } from '../components/ui/button'
import { Footer } from '../components/layout/Footer'
import { useAuth } from '../hooks/useAuth'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { supabase } from '../lib/supabase'
import { Mail, CheckCircle2, Loader2 } from 'lucide-react'

function getResendButtonContent(isResending: boolean, resendSuccess: boolean): ReactNode {
  if (isResending) {
    return (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Invio in corso...
      </>
    )
  }
  if (resendSuccess) {
    return (
      <>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Email inviata!
      </>
    )
  }
  return "Invia nuovamente l'email"
}

export function VerifyEmailPage() {
  useDocumentMeta('Verifica email')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [email, setEmail] = useState<string>('')
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  // Guard against React StrictMode double-invoking the effect (which would
  // consume the one-shot sessionStorage email and wrongly redirect to /signup)
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    async function loadEmail() {
      // Try to get email from sessionStorage first (secure, not in URL)
      const sessionEmail = sessionStorage.getItem('verify_email')
      if (sessionEmail) {
        setEmail(sessionEmail)
        // Clear it after use for security
        sessionStorage.removeItem('verify_email')
        return
      }

      // Fallback: check URL param (legacy support)
      const emailParam = searchParams.get('email')
      if (emailParam) {
        setEmail(emailParam)
        return
      }

      // Last fallback: try to get from Supabase session
      try {
        const { data } = await supabase.auth.getUser()
        if (data.user?.email) {
          setEmail(data.user.email)
          return
        }
      } catch (error) {
        console.error('Error getting user email:', error)
      }

      // If no email found anywhere, redirect to signup
      navigate('/signup', { replace: true })
    }

    loadEmail()
  }, [searchParams, navigate])

  // Redirect to home if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, authLoading, navigate])

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Indirizzo email non trovato')
      return
    }

    setIsResending(true)
    setResendSuccess(false)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) {
        toast.error(error.message)
      } else {
        setResendSuccess(true)
        toast.success('Email di conferma inviata nuovamente!')
      }
    } catch {
      toast.error('Errore durante l\'invio dell\'email')
    } finally {
      setIsResending(false)
    }
  }

  if (authLoading) {
    return <AuthLoadingScreen />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              {resendSuccess ? (
                <CheckCircle2 className="h-10 w-10 text-primary" />
              ) : (
                <Mail className="h-10 w-10 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Controlla la tua email</h1>
            <p className="mt-2 text-muted-foreground">Ti abbiamo inviato un link di conferma</p>
          </div>

          <div className="rounded-lg border bg-card p-6 space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Email inviata a:
              </p>
              <p className="font-medium text-foreground break-all">
                {email}
              </p>
            </div>

            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Prossimi passi:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Apri la tua casella di posta elettronica</li>
                <li>Cerca l'email di conferma da entro</li>
                <li>Clicca sul link di conferma nell'email</li>
                <li>Verrai reindirizzato automaticamente all'app</li>
              </ol>
            </div>

            <div className="pt-2 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Non hai ricevuto l'email?
                  </span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>Controlla la cartella spam o promozioni</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={isResending || resendSuccess}
                >
                  {getResendButtonContent(isResending, resendSuccess)}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-center text-sm text-muted-foreground">
            <div>
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
                Torna al login
              </Link>
            </div>
            <div>
              Email sbagliata?{' '}
              <Link
                to="/signup"
                className="font-medium text-primary hover:underline"
              >
                Registrati di nuovo
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default VerifyEmailPage
