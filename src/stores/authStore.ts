import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { onAuthStateChange, getSession, getCurrentUser } from '../lib/auth'
import { acceptInviteByEmail, getUserList, createPersonalList } from '../lib/invites'

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
      // Get initial session
      const session = await getSession()
      const user = await getCurrentUser()

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
            // Store flag to show toast after reload
            localStorage.setItem('show_welcome_toast', 'true')
            // Refresh the page to load the new list data
            // Note: We DON'T set the processed flag here - we'll check again after reload
            window.location.reload()
            return
          } else if (error) {
            console.error('[authStore] Failed to accept invite:', error.message)
            // Don't return - try to create personal list as fallback
          }

          // FOURTH: No pending invite (or invite failed), create a personal list
          const { success: listCreated, error: createError } = await createPersonalList()

          if (listCreated) {
            // Refresh to load the new list
            // Note: We DON'T set the processed flag here - we'll check again after reload
            window.location.reload()
          } else {
            console.error('[authStore] Failed to create personal list:', createError)
            // Mark as processed to prevent infinite retries
            sessionStorage.setItem(processedKey, 'true')
          }
        } catch (error) {
          console.error('[authStore] Error initializing user:', error)
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
      if (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token')) {
        // Use replaceState to avoid adding to browser history
        const cleanUrl = window.location.pathname + window.location.search
        window.history.replaceState({}, document.title, cleanUrl)
      }

      // Track previous auth state to detect login
      let wasAuthenticated = user !== null

      // Setup auth state change listener
      const unsubscribe = onAuthStateChange((event, user, session) => {
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
          console.warn('[authStore] ⚠️  SECURITY: Unexpected auto-login detected!', {
            event,
            url: window.location.href,
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

      return unsubscribe
    } catch (error) {
      console.error('Error initializing auth:', error)
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
