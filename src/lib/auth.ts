import { supabase } from './supabase'
import { unsubscribeFromPush } from './pushNotifications'
import { clearPersistedCache } from './queryPersister'
import { logError } from './safeLog'
import { authErrorMessage } from './authErrorMessage'
import { userFacingError } from './userFacingError'
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
 * Also clears the React Query IndexedDB cache to prevent data leaking
 * between accounts.
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

  // Clear persisted React Query cache (IndexedDB) — best-effort, fire and forget
  clearPersistedCache().catch(() => {})
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
 * L'errore di una funzione il cui esito **una pagina mostra**.
 *
 * Fino alla #100 qui passava `error.message`, cioè il testo di Supabase Auth:
 * in inglese, e con l'auth irraggiungibile la risposta serializzata. Il
 * messaggio lo sceglie la tabella di `authErrorMessage`, per `error.code`;
 * l'originale resta in `cause` per chi diagnostica. Per questo più sotto si
 * rilancia `error` com'è e non `new Error(error.message)`, che perdeva il
 * `code`.
 *
 * `signOut` non passa di qui: i suoi messaggi li sceglie `useAuth`.
 */
function shownError(error: unknown): Error {
  return userFacingError(authErrorMessage(error), error)
}

function authFailure(error: unknown): AuthResponse {
  return { user: null, session: null, error: shownError(error) }
}

/**
 * Sign up a new user with email, password, and full name.
 *
 * Il codice invito, se c'è, va nei metadati: il trigger `on_auth_user_created`
 * lo legge e mette l'utente nella lista di chi l'ha invitato mentre lo crea
 * (#165). Passato dopo, l'utente avrebbe già una lista sua.
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  inviteCode?: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(inviteCode ? { invite_code: inviteCode.toUpperCase() } : {}),
        },
      },
    })

    if (error) throw error

    markExplicitAuth(data.session)

    return { user: data.user, session: data.session, error: null }
  } catch (error) {
    return authFailure(error)
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

    if (error) throw error

    markExplicitAuth(data.session)

    return { user: data.user, session: data.session, error: null }
  } catch (error) {
    return authFailure(error)
  }
}

/**
 * Esito di `signOut()`.
 *
 * I due campi rispondono a domande diverse e non vanno confusi: `error` dice
 * se qualcosa è andato storto, `localSessionCleared` se su questo dispositivo
 * l'utente è effettivamente uscito. Chi decide dove mandare l'utente deve
 * guardare il secondo — un logout rifiutato dal server con la pulizia locale
 * riuscita è comunque un logout, qui.
 */
export type SignOutResult = {
  error: Error | null
  /** True quando i token locali sono spariti davvero. */
  localSessionCleared: boolean
}

/**
 * Sign out the current user and clear session.
 * Selectively clears auth-related storage while preserving app settings.
 */
export async function signOut(): Promise<SignOutResult> {
  // Best-effort push cleanup -- errors are ignored since the user is signing out
  await unsubscribeFromPush().catch(() => {})

  let failure: Error | null = null

  try {
    // Solo la sessione di questo browser: il default di supabase-js è
    // `global`, che chiuderebbe anche il telefono e gli altri browser.
    // entro-family, `conventions/sign-out-scope.md`.
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) {
      failure = new Error(error.message)
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error('Errore durante il logout')
  }

  // La pulizia non dipende dall'esito di Supabase. Il caso tipico è la sessione
  // già scaduta lato server: la richiesta viene rifiutata, ma i token devono
  // sparire dal browser lo stesso, altrimenti restano leggibili in localStorage
  // su una macchina condivisa e il client può ricostruirci sopra una sessione.
  // Guardata a sua volta perché accedere a `localStorage` solleva quando il
  // browser blocca lo storage, e nessun wrapper di questo modulo deve sollevare.
  let localSessionCleared = true

  try {
    clearAuthStorage()
  } catch (error) {
    localSessionCleared = false
    failure ??= error instanceof Error ? error : new Error('Errore durante la pulizia della sessione')
  }

  // L'errore di Supabase ha la precedenza: è la causa, la pulizia è la conseguenza.
  return { error: failure, localSessionCleared }
}

/**
 * Chiude le sessioni degli altri dispositivi e lascia questa (#143): chi perde
 * un telefono lo chiude da qui, senza passare dal recupero password.
 *
 * Con `scope: 'others'` la sessione corrente non riceve nessun evento
 * (`@supabase/auth-js`), quindi l'esito lo legge chi chiama, dal risultato.
 * Niente pulizia dello storage: questo browser resta dentro, qualunque sia
 * l'esito. Non solleva mai.
 */
export async function signOutOtherDevices(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    return { error: error ? shownError(error) : null }
  } catch (error) {
    return { error: shownError(error) }
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
        logError('Error getting current user:', error)
      }
      return null
    }

    return data.user
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!isSessionMissingError(message)) {
      logError('Error getting current user:', error)
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
    logError('Error getting session:', error)
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
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error: shownError(error) }
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
    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error: shownError(error) }
  }
}
