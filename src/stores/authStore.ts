import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import {
  onAuthStateChange,
  getSession,
  getCurrentUser,
  clearAuthStorage,
  readStoredSession,
  signOut,
  verifySession,
} from '../lib/auth'
import { clearSignedImageCaches } from '../lib/signedImageCache'
import { logError, redactUrl } from '../lib/safeLog'
import { acceptInviteByEmail, getUserList, createPersonalList } from '../lib/invites'
import { queryClient } from '../lib/queryClient'
import { notifyWelcomeToast } from '../lib/welcomeToast'

/**
 * Auth Store State
 */
interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
}

/**
 * Auth Store Actions
 */
interface AuthActions {
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  clearAuth: () => void
  initialize: () => Promise<() => void>
}

/**
 * Combined Auth Store
 */
type AuthStore = AuthState & AuthActions

async function refreshAuthenticatedData(): Promise<void> {
  await queryClient.invalidateQueries()
}

/**
 * Zustand Auth Store with Supabase Auth Integration
 */
export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,

  // Actions
  setUser: (user) => {
    set({
      user,
      isAuthenticated: user !== null,
    })
  },

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: session?.user !== null,
    })
  },

  setLoading: (loading) => {
    set({ loading })
  },

  clearAuth: () => {
    set({
      user: null,
      session: null,
      isAuthenticated: false,
      loading: false,
    })
  },

  /**
   * Initialize auth state and setup Supabase listener
   * Returns unsubscribe function for cleanup
   */
  initialize: async () => {
    try {
      // Password reset e magic link portano la sessione nell'URL: la legge
      // auth-js, e lì si aspetta lui. In ogni altro avvio fra dashboard e
      // login decide la sessione salvata, non la rete: un server che non
      // risponde non è un'uscita, e l'attesa dura quanto la lettura
      // dell'archivio (#216).
      const sessionInUrl =
        window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token')
      const session = sessionInUrl ? await getSession() : readStoredSession()
      const user = sessionInUrl ? await getCurrentUser() : (session?.user ?? null)

      set({
        user,
        session,
        isAuthenticated: user !== null,
        loading: false,
      })

      // Check invite acceptance and list initialization helper
      const checkAndAcceptInvite = async (user: User) => {
        const processedKey = `user_initialized_${user.email}`

        try {
          // FIRST: Check if user already has a list (most common case after initial setup)
          const { list } = await getUserList()

          if (list) {
            // User has a list, mark as processed and we're done
            sessionStorage.setItem(processedKey, 'true')
            return
          }

          // SECOND: User doesn't have a list, check if already processed this session
          if (sessionStorage.getItem(processedKey)) {
            // Clear the flag to allow retry
            sessionStorage.removeItem(processedKey)
          }

          // THIRD: Try to accept any pending invite
          const { success: inviteAccepted, listId, error } = await acceptInviteByEmail()

          if (inviteAccepted && listId) {
            // Signal the dashboard to show the welcome toast. Works whether the
            // dashboard is already mounted (event) or mounts later (flag).
            notifyWelcomeToast()
            await refreshAuthenticatedData()
            sessionStorage.setItem(processedKey, 'true')
            return
          } else if (error) {
            logError('[authStore] Failed to accept invite:', error)
            // Don't return - try to create personal list as fallback
          }

          // FOURTH: No pending invite (or invite failed), create a personal list
          const { success: listCreated, error: createError } = await createPersonalList()

          if (listCreated) {
            await refreshAuthenticatedData()
            sessionStorage.setItem(processedKey, 'true')
          } else {
            logError('[authStore] Failed to create personal list:', createError)
            // Mark as processed to prevent infinite retries
            sessionStorage.setItem(processedKey, 'true')
          }
        } catch (error) {
          logError('[authStore] Error initializing user:', error)
          // Mark as processed to prevent infinite retries on persistent errors
          sessionStorage.setItem(processedKey, 'true')
        }
      }

      // Check for pending invites on initial load if user is authenticated
      // This handles the case where user confirms email and is redirected already logged in
      if (user) {
        checkAndAcceptInvite(user)
      }

      // Security: Remove auth tokens from URL after they've been processed
      // This prevents accidental sharing of URLs with active tokens
      if (sessionInUrl) {
        // Use replaceState to avoid adding to browser history
        const cleanUrl = window.location.pathname + window.location.search
        window.history.replaceState({}, document.title, cleanUrl)
      }

      // Track previous auth state to detect login
      let wasAuthenticated = user !== null

      // Setup auth state change listener
      const unsubscribe = onAuthStateChange((event, user, session) => {
        // Una sessione vuota è un'uscita solo se lo dice `SIGNED_OUT`. Con il
        // token scaduto e il server irraggiungibile auth-js consegna
        // `INITIAL_SESSION` con `null` e lascia la sessione in archivio:
        // prenderlo per un'uscita mandava al login chi era dentro (#216).
        if (user === null && event !== 'SIGNED_OUT') return

        const isNowAuthenticated = user !== null

        // Check if this is an explicit user action or auto-login
        const hasExplicitAuthFlag = sessionStorage.getItem('explicit_auth')
        const isAutoLogin = !wasAuthenticated && isNowAuthenticated && !hasExplicitAuthFlag

        // List of auth events that are considered safe and expected
        const authorizedAutoLoginEvents = [
          'PASSWORD_RECOVERY',  // User clicked password reset link
          'SIGNED_IN',          // User signed in (could be via magic link)
          'TOKEN_REFRESHED',    // Existing session refreshed
          'USER_UPDATED',       // User data updated
        ]

        // Security check: warn about unexpected auto-login
        if (isAutoLogin && !authorizedAutoLoginEvents.includes(event)) {
          // Il secondo argomento non è un errore ma un oggetto costruito a
          // mano campo per campo, con l'URL già ridotto da `redactUrl`: non
          // c'è nessuna proprietà di provenienza Supabase che possa uscire di
          // rimbalzo, ed è un avviso che serve strutturato.
          // eslint-disable-next-line no-restricted-syntax
          console.warn('[authStore] ⚠️  SECURITY: Unexpected auto-login detected!', {
            event,
            // Origine e percorso, senza query né frammento: è proprio lì che
            // starebbe il token che questo avviso sospetta.
            url: redactUrl(window.location.href),
            email: user?.email,
            suggestion: 'This could be from a shared URL with auth token. User should logout if this was not intentional.',
          })
        }

        // Mark auto-login from authorized events as explicit for future checks
        if (isAutoLogin && authorizedAutoLoginEvents.includes(event)) {
          sessionStorage.setItem('explicit_auth', Date.now().toString())
        }

        set({
          user,
          session,
          isAuthenticated: isNowAuthenticated,
          loading: false,
        })

        // Un'uscita non passa sempre da «Disconnetti»: la sessione può essere
        // chiusa da un altro dispositivo («Esci dagli altri dispositivi»),
        // scadere, o sparire con l'account. Qui arriva lo stesso `SIGNED_OUT`,
        // e ciò che questo browser tiene dell'utente deve sparire lo stesso
        // (#213). Su «Disconnetti» gira due volte, ed è innocuo.
        if (event === 'SIGNED_OUT') {
          try {
            clearAuthStorage()
          } catch (error) {
            logError('Pulizia locale fallita dopo SIGNED_OUT', error)
          }
        }

        // E chi entra parte da una cache delle foto vuota, qualunque cosa sia
        // rimasta da prima: una richiesta ancora in volo può riscrivere una
        // voce dopo la pulizia dell'uscita. Solo all'accesso vero, non
        // all'avvio con una sessione già aperta: lì le foto servono offline.
        if (!wasAuthenticated && isNowAuthenticated) {
          clearSignedImageCaches().catch(() => {})
        }

        // Skip invite checks and redirects during password recovery flow
        if (event === 'PASSWORD_RECOVERY') {
          return
        }

        // Check for pending invites when user logs in (transitions from logged out to logged in)
        if (!wasAuthenticated && isNowAuthenticated && user) {
          checkAndAcceptInvite(user)
        }

        wasAuthenticated = isNowAuthenticated
      })

      // Se la sessione salvata vale ancora lo dice il server, dopo e senza far
      // aspettare nessuno. Esce solo chi il server rifiuta, con la pulizia di
      // «Disconnetti»; e solo se è ancora lui, non chi è entrato nel frattempo.
      if (user && !sessionInUrl) {
        void verifySession().then(async (verdict) => {
          if (verdict !== 'rejected') return
          if (useAuthStore.getState().user?.id !== user.id) return
          await signOut()
          set({ user: null, session: null, isAuthenticated: false, loading: false })
        })
      }

      return unsubscribe
    } catch (error) {
      logError('Error initializing auth:', error)
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        loading: false,
      })
      return () => {}
    }
  },
}))
