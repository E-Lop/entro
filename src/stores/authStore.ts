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

      // Check for pending invites on initial load if user is authenticated
      if (user) {
        console.log('Checking for pending invites for user:', user.email)
        acceptInviteByEmail().then(({ success, listId, error }) => {
          if (success && listId) {
            console.log('Auto-accepted pending invite for list:', listId)
            // Refresh the page to load the new list data
            window.location.reload()
          } else if (error) {
            console.log('No pending invite or error accepting:', error.message)
          } else {
            console.log('No pending invite found for this email')
          }
        }).catch((error) => {
          console.error('Error checking for pending invites:', error)
        })
      }

      // Track previous auth state to detect login
      let wasAuthenticated = user !== null

      // Setup auth state change listener
      const unsubscribe = onAuthStateChange((user, session) => {
        const isNowAuthenticated = user !== null

        set({
          user,
          session,
          isAuthenticated: isNowAuthenticated,
          loading: false,
        })

        // Check for pending invites when user logs in (transitions from logged out to logged in)
        if (!wasAuthenticated && isNowAuthenticated && user) {
          console.log('User just logged in, checking for pending invites:', user.email)
          acceptInviteByEmail().then(({ success, listId, error }) => {
            if (success && listId) {
              console.log('Auto-accepted pending invite for list:', listId)
              // Refresh the page to load the new list data
              window.location.reload()
            } else if (error) {
              console.log('No pending invite or error accepting:', error.message)
            } else {
              console.log('No pending invite found for this email')
            }
          }).catch((error) => {
            console.error('Error checking for pending invites:', error)
          })
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
