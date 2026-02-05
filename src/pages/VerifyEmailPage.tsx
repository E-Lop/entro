import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Footer } from '../components/layout/Footer'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Mail, CheckCircle2, Loader2 } from 'lucide-react'

export function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [email, setEmail] = useState<string>('')
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    } else {
      // If no email in URL, redirect to signup
      navigate('/signup', { replace: true })
    }
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
    } catch (error) {
      toast.error('Errore durante l\'invio dell\'email')
    } finally {
      setIsResending(false)
    }
  }

  if (authLoading) {
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
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              {resendSuccess ? (
                <CheckCircle2 className="h-10 w-10 text-primary" />
              ) : (
                <Mail className="h-10 w-10 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              Controlla la tua email
            </CardTitle>
            <CardDescription className="text-base">
              Ti abbiamo inviato un link di conferma
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-600 mb-2">
                Email inviata a:
              </p>
              <p className="font-medium text-slate-900 break-all">
                {email}
              </p>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
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
                  <span className="bg-white px-2 text-muted-foreground">
                    Non hai ricevuto l'email?
                  </span>
                </div>
              </div>

              <div className="text-sm text-slate-600 space-y-2">
                <p>Controlla la cartella spam o promozioni</p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleResendEmail}
                  disabled={isResending || resendSuccess}
                >
                  {isResending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Invio in corso...
                    </>
                  ) : resendSuccess ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Email inviata!
                    </>
                  ) : (
                    'Invia nuovamente l\'email'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2 text-center">
            <div className="text-sm text-slate-600">
              <Link
                to="/login"
                className="font-medium text-primary hover:underline"
              >
                Torna al login
              </Link>
            </div>
            <div className="text-sm text-slate-600">
              Email sbagliata?{' '}
              <Link
                to="/signup"
                className="font-medium text-primary hover:underline"
              >
                Registrati di nuovo
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
      <Footer />
    </div>
  )
}

export default VerifyEmailPage
