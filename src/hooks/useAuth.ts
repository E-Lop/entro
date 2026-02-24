import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import * as authService from '../lib/auth'

/**
 * Custom hook for authentication
 * Provides clean API for components to access auth state and actions
 */
export function useAuth() {
  // Get state from Zustand store
  const { user, session, loading, isAuthenticated } = useAuthStore()

  /**
   * Sign up a new user with full name
   */
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { user, error } = await authService.signUp(email, password, fullName)

    if (error) {
      toast.error(error.message)
      return { success: false, error }
    }

    if (user) {
      return { success: true, error: null }
    }

    return { success: false, error: new Error('Registrazione fallita') }
  }, [])

  /**
   * Sign in an existing user
   */
  const signIn = useCallback(async (email: string, password: string) => {
    const { user, error } = await authService.signIn(email, password)

    if (error) {
      toast.error(error.message)
      return { success: false, error }
    }

    if (user) {
      toast.success('Accesso effettuato!')
      return { success: true, error: null }
    }

    return { success: false, error: new Error('Login fallito') }
  }, [])

  /**
   * Sign out the current user
   */
  const signOut = useCallback(async () => {
    const { error } = await authService.signOut()

    if (error) {
      toast.error(error.message)
      return { success: false, error }
    }

    toast.success('Disconnesso con successo')
    return { success: true, error: null }
  }, [])

  return {
    // State
    user,
    session,
    loading,
    isAuthenticated,

    // Actions
    signUp,
    signIn,
    signOut,
  }
}
