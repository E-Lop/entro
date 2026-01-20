import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { toast } from 'sonner'
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
          console.log('Invite already processed in this session')
          return
        }

        console.log('Checking for pending invites for user:', user.email)

        try {
          const { success, listId, error } = await acceptInviteByEmail()

          if (success && listId) {
            console.log('Auto-accepted pending invite for list:', listId)
            // Mark as processed to prevent re-checking
            sessionStorage.setItem(inviteAcceptedKey, 'true')
            // Show success toast before reload
            toast.success('Benvenuto! Ora puoi vedere la lista condivisa', {
              duration: 5000,
            })
            // Refresh the page to load the new list data after a short delay
            setTimeout(() => {
              window.location.reload()
            }, 500)
          } else if (error) {
            console.log('No pending invite or error accepting:', error.message)
          } else {
            console.log('No pending invite found for this email')
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
