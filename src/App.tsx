import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './stores/authStore'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { OfflineBanner } from './components/pwa/OfflineBanner'

// Lazy load pages for code splitting
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TestConnection = lazy(() => import('./pages/TestConnection'))
const JoinPage = lazy(() => import('./pages/JoinPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary"></div>
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    </div>
  )
}

function App() {
  const initialize = useAuthStore((state) => state.initialize)

  // Initialize auth state on mount
  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    initialize().then((unsub) => {
      unsubscribe = unsub
    })

    // Cleanup: unsubscribe from auth listener
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [initialize])

  return (
    <>
      <OfflineBanner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/join/:code" element={<JoinPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/test-connection" element={<TestConnection />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>

      {/* Toast notifications */}
      <Toaster position="top-center" richColors />
    </>
  )
}

export default App
