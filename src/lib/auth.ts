import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

/**
 * Auth Service Layer - Wrapper functions around Supabase Auth API
 */

export interface AuthResponse {
  user: User | null
  session: Session | null
  error: Error | null
}

/**
 * Sign up a new user with email, password, and full name
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      throw new Error(error.message)
    }

    // Mark this as an explicit user action (not auto-login from URL)
    if (data.session) {
      sessionStorage.setItem('explicit_auth', Date.now().toString())
    }

    return {
      user: data.user,
      session: data.session,
      error: null,
    }
  } catch (error) {
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error('Errore durante la registrazione'),
    }
  }
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    // Mark this as an explicit user action (not auto-login from URL)
    if (data.session) {
      sessionStorage.setItem('explicit_auth', Date.now().toString())
    }

    return {
      user: data.user,
      session: data.session,
      error: null,
    }
  } catch (error) {
    return {
      user: null,
      session: null,
      error: error instanceof Error ? error : new Error('Errore durante il login'),
    }
  }
}

/**
 * Sign out the current user and clear session
 * Selectively clears auth-related storage to prevent session persistence
 * while preserving app settings and service worker data
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }

    // Selectively clear only auth-related data from localStorage
    // This preserves service worker cache, theme, and other app settings
    const localStorageKeysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (
        key.startsWith('sb-') ||           // Supabase auth keys
        key === 'supabase.auth.token' ||   // Legacy Supabase key
        key === 'show_welcome_toast'       // User-specific flag
      )) {
        localStorageKeysToRemove.push(key)
      }
    }
    localStorageKeysToRemove.forEach(key => localStorage.removeItem(key))

    // Clear auth-related sessionStorage
    const sessionStorageKeysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (
        key.startsWith('user_initialized_') || // User initialization flags
        key === 'explicit_auth' ||             // Explicit auth tracking
        key === 'verify_email'                 // Email verification
      )) {
        sessionStorageKeysToRemove.push(key)
      }
    }
    sessionStorageKeysToRemove.forEach(key => sessionStorage.removeItem(key))

    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Errore durante il logout'),
    }
  }
}

/**
 * Get the currently authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      // "Auth session missing" is expected when user is not logged in
      // Don't log this as an error
      const isSessionMissing = error.message?.toLowerCase().includes('session') &&
                               error.message?.toLowerCase().includes('missing')

      if (!isSessionMissing) {
        console.error('Error getting current user:', error)
      }

      return null
    }

    return data.user
  } catch (error) {
    // Only log unexpected errors
    const errorMessage = error instanceof Error ? error.message : ''
    const isSessionMissing = errorMessage.toLowerCase().includes('session') &&
                             errorMessage.toLowerCase().includes('missing')

    if (!isSessionMissing) {
      console.error('Error getting current user:', error)
    }
    return null
  }
}

/**
 * Get the current session
 */
export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw new Error(error.message)
    }

    return data.session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Subscribe to auth state changes
 * Returns an unsubscribe function
 */
export function onAuthStateChange(
  callback: (event: string, user: User | null, session: Session | null) => void
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session?.user ?? null, session)
    }
  )

  return () => subscription.unsubscribe()
}

/**
 * Send password reset email to user
 */
export async function resetPasswordRequest(
  email: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      throw new Error(error.message)
    }

    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Errore durante l\'invio dell\'email'),
    }
  }
}

/**
 * Update user password with new password
 */
export async function updatePassword(
  newPassword: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      throw new Error(error.message)
    }

    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Errore durante l\'aggiornamento della password'),
    }
  }
}
