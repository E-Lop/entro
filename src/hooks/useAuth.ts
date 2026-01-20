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
    try {
      const { user, error } = await authService.signUp(email, password, fullName)

      if (error) {
        toast.error(error.message)
        return { success: false, error }
      }

      if (user) {
        // Don't show generic success toast - let the page handle messaging
        return { success: true, error: null }
      }

      return { success: false, error: new Error('Registrazione fallita') }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore durante la registrazione'
      toast.error(errorMessage)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
      }
    }
  }, [])

  /**
   * Sign in an existing user
   */
  const signIn = useCallback(async (email: string, password: string) => {
    try {
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore durante il login'
      toast.error(errorMessage)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
      }
    }
  }, [])

  /**
   * Sign out the current user
   */
  const signOut = useCallback(async () => {
    try {
      const { error } = await authService.signOut()

      if (error) {
        toast.error(error.message)
        return { success: false, error }
      }

      toast.success('Disconnesso con successo')
      return { success: true, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore durante il logout'
      toast.error(errorMessage)
      return {
        success: false,
        error: error instanceof Error ? error : new Error(errorMessage),
      }
    }
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
