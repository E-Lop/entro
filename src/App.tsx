import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './stores/authStore'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { OfflineBanner } from './components/pwa/OfflineBanner'
import { PageLoader } from './components/ui/PageLoader'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignUpPage = lazy(() => import('./pages/SignUpPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const TestConnection = lazy(() => import('./pages/TestConnection'))
const JoinPage = lazy(() => import('./pages/JoinPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const GuidaPage = lazy(() => import('./pages/GuidaPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))

function App() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    initialize().then((unsub) => {
      unsubscribe = unsub
    })

    return () => {
      unsubscribe?.()
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
                <Route path="/guida" element={<GuidaPage />} />
                <Route path="/test-connection" element={<TestConnection />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster position="top-center" richColors />
    </>
  )
}

export default App
