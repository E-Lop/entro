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
      const checkAndAcceptInvite = async (user: any) => {
        console.log('[authStore] checkAndAcceptInvite starting for user:', {
          userId: user.id,
          email: user.email,
          emailVerified: user.email_confirmed_at,
        })

        const processedKey = `user_initialized_${user.email}`

        try {
          // FIRST: Check if user already has a list (most common case after initial setup)
          console.log('[authStore] Checking if user has existing list')
          const { list, error: listError } = await getUserList()

          console.log('[authStore] getUserList result:', {
            hasListId: list?.id,
            error: listError?.message,
          })

          if (list) {
            // User has a list, mark as processed and we're done
            console.log('[authStore] User already has a list, marking as processed')
            sessionStorage.setItem(processedKey, 'true')
            return
          }

          // SECOND: User doesn't have a list, check if already processed this session
          if (sessionStorage.getItem(processedKey)) {
            console.log('[authStore] User has no list but already processed in this session')
            console.warn('[authStore] This might indicate a previous operation failed')
            // Clear the flag to allow retry
            sessionStorage.removeItem(processedKey)
          }

          // THIRD: Try to accept any pending invite
          console.log('[authStore] User has no list, attempting to accept pending invite')
          const { success: inviteAccepted, listId, error } = await acceptInviteByEmail()

          console.log('[authStore] acceptInviteByEmail result:', {
            success: inviteAccepted,
            listId,
            error: error?.message,
          })

          if (inviteAccepted && listId) {
            console.log('[authStore] Invite accepted successfully, reloading to show new list')
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
          console.log('[authStore] Creating personal list for new user...')
          const { success: listCreated, error: createError } = await createPersonalList()

          console.log('[authStore] createPersonalList result:', {
            success: listCreated,
            error: createError?.message,
          })

          if (listCreated) {
            console.log('[authStore] Personal list created successfully, reloading')
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
