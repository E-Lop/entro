import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthForm } from '../components/auth/AuthForm'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../hooks/useAuth'

export function SignUpPage() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()

  // Redirect to home if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, loading, navigate])

  const handleSuccess = () => {
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
            Inizia a tracciare le scadenze dei tuoi alimenti
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
