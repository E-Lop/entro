import { useCallback } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../stores/authStore'
import * as authService from '../lib/auth'
import { logError } from '@/lib/safeLog'

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
  const signUp = useCallback(async (email: string, password: string, fullName: string, inviteCode?: string) => {
    const { user, error } = await authService.signUp(email, password, fullName, inviteCode)

    if (error) {
      // Error surfaced inline by AuthForm, not as a transient toast
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
      // Error surfaced inline by AuthForm, not as a transient toast
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
    const { error, localSessionCleared } = await authService.signOut()

    // supabase-js emette `SIGNED_OUT` solo quando la chiamata riesce o quando
    // il server risponde 401/403/404; se la rete cade non emette nulla e lo
    // store resterebbe pieno mentre i token locali sono già spariti. Quando la
    // pulizia locale è riuscita l'utente **è** uscito da qui, e lo store deve
    // dirlo.
    if (localSessionCleared) {
      useAuthStore.getState().clearAuth()
    }

    if (error) {
      logError('Logout rifiutato dal server', error)

      // Con la pulizia locale riuscita l'utente è uscito da qui, e con lo
      // scope locale non c'è un «altrove» da segnalare: nessun messaggio.
      // Resta quello per la pulizia fallita, perché lì può essere ancora
      // dentro. Il testo di Supabase non arriva mai all'utente: è in inglese
      // e può contenere identificativi di sessione.
      if (!localSessionCleared) {
        toast.error('Non è stato possibile completare la disconnessione. Chiudi il browser per sicurezza.')
      }
      return { success: false, error, localSessionCleared }
    }

    toast.success('Disconnesso con successo')
    return { success: true, error: null, localSessionCleared }
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
