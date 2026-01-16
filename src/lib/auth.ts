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
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }

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
      throw new Error(error.message)
    }

    return data.user
  } catch (error) {
    console.error('Error getting current user:', error)
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
  callback: (user: User | null, session: Session | null) => void
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session?.user ?? null, session)
    }
  )

  return () => subscription.unsubscribe()
}
