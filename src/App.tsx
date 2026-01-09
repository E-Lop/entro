import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from './stores/authStore'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { DashboardPage } from './pages/DashboardPage'
import TestConnection from './pages/TestConnection'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'

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
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/test-connection" element={<TestConnection />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>

      {/* Toast notifications */}
      <Toaster position="top-center" richColors />
    </>
  )
}

export default App
