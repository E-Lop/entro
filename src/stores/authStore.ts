import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { onAuthStateChange, getSession, getCurrentUser } from '../lib/auth'
import { acceptInviteByEmail } from '../lib/invites'

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

      // Check invite acceptance helper
      const checkAndAcceptInvite = async (user: any) => {
        // Check if we already accepted an invite in this session
        const inviteAcceptedKey = `invite_accepted_${user.email}`
        if (sessionStorage.getItem(inviteAcceptedKey)) {
          return
        }

        try {
          const { success, listId, error } = await acceptInviteByEmail()

          if (success && listId) {
            // Mark as processed to prevent re-checking
            sessionStorage.setItem(inviteAcceptedKey, 'true')
            // Store flag to show toast after reload
            localStorage.setItem('show_welcome_toast', 'true')
            // Refresh the page to load the new list data
            window.location.reload()
          } else if (error) {
            console.error('Failed to accept invite:', error.message)
          }
        } catch (error) {
          console.error('Error checking for pending invites:', error)
        }
      }

      // Check for pending invites on initial load if user is authenticated
      // This handles the case where user confirms email and is redirected already logged in
      if (user) {
        checkAndAcceptInvite(user)
      }

      // Track previous auth state to detect login
      let wasAuthenticated = user !== null

      // Setup auth state change listener
      const unsubscribe = onAuthStateChange((event, user, session) => {
        const isNowAuthenticated = user !== null

        set({
          user,
          session,
          isAuthenticated: isNowAuthenticated,
          loading: false,
        })

        // Skip invite checks and redirects during password recovery flow
        if (event === 'PASSWORD_RECOVERY') {
          console.log('Password recovery session detected - staying on reset page')
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
