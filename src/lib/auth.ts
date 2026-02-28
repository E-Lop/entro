import { supabase } from './supabase'
import { unsubscribeFromPush } from './pushNotifications'
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
 * Selectively clear auth-related keys from a storage object.
 * Preserves non-auth data like service worker cache, theme, and app preferences.
 */
function clearAuthKeys(storage: Storage, matchers: Array<string | ((key: string) => boolean)>): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key) continue
    const shouldRemove = matchers.some(matcher =>
      typeof matcher === 'string' ? key === matcher : matcher(key)
    )
    if (shouldRemove) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => storage.removeItem(key))
}

/**
 * Clear all auth-related data from both localStorage and sessionStorage.
 * Preserves service worker cache, theme, and other app settings.
 */
export function clearAuthStorage(): void {
  clearAuthKeys(localStorage, [
    (key) => key.startsWith('sb-'),
    'supabase.auth.token',
    'show_welcome_toast',
  ])

  clearAuthKeys(sessionStorage, [
    (key) => key.startsWith('user_initialized_'),
    'explicit_auth',
    'verify_email',
  ])
}

/**
 * Mark a session as an explicit user action (not auto-login from URL).
 */
function markExplicitAuth(session: Session | null): void {
  if (session) {
    sessionStorage.setItem('explicit_auth', Date.now().toString())
  }
}

/**
 * Wrap an error into the AuthResponse failure shape.
 */
function authFailure(error: unknown, fallbackMessage: string): AuthResponse {
  return {
    user: null,
    session: null,
    error: error instanceof Error ? error : new Error(fallbackMessage),
  }
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
      options: { data: { full_name: fullName } },
    })

    if (error) throw new Error(error.message)

    markExplicitAuth(data.session)

    return { user: data.user, session: data.session, error: null }
  } catch (error) {
    return authFailure(error, 'Errore durante la registrazione')
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

    if (error) throw new Error(error.message)

    markExplicitAuth(data.session)

    return { user: data.user, session: data.session, error: null }
  } catch (error) {
    return authFailure(error, 'Errore durante il login')
  }
}

/**
 * Sign out the current user and clear session.
 * Selectively clears auth-related storage while preserving app settings.
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    // Best-effort push cleanup -- errors are ignored since the user is signing out
    await unsubscribeFromPush().catch(() => {})

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }

    clearAuthStorage()

    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Errore durante il logout'),
    }
  }
}

/**
 * Check if an error message indicates a missing auth session.
 * This is expected when no user is logged in and should not be logged.
 */
function isSessionMissingError(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('session') && lower.includes('missing')
}

/**
 * Get the currently authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      if (!isSessionMissingError(error.message ?? '')) {
        console.error('Error getting current user:', error)
      }
      return null
    }

    return data.user
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!isSessionMissingError(message)) {
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
    if (error) throw new Error(error.message)
    return data.session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: string, user: User | null, session: Session | null) => void
): () => void {
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
    if (error) throw new Error(error.message)
    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Errore durante l\'invio dell\'email'),
    }
  }
}

/**
 * Update user password
 */
export async function updatePassword(
  newPassword: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Errore durante l\'aggiornamento della password'),
    }
  }
}
