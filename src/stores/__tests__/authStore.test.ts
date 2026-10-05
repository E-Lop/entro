import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'
import { makeLocalStorage } from '../../test/localStorage'
import { useAuthStore } from '../authStore'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  getUserList: vi.fn(),
  acceptInviteByEmail: vi.fn(),
  createPersonalList: vi.fn(),
  invalidateQueries: vi.fn(),
  clearAuthStorage: vi.fn(),
  clearSignedImageCaches: vi.fn(),
}))

vi.mock('../../lib/auth', () => ({
  getSession: mocks.getSession,
  getCurrentUser: mocks.getCurrentUser,
  onAuthStateChange: mocks.onAuthStateChange,
  clearAuthStorage: mocks.clearAuthStorage,
}))

vi.mock('../../lib/signedImageCache', () => ({
  clearSignedImageCaches: mocks.clearSignedImageCaches,
}))

vi.mock('../../lib/invites', () => ({
  getUserList: mocks.getUserList,
  acceptInviteByEmail: mocks.acceptInviteByEmail,
  createPersonalList: mocks.createPersonalList,
}))

vi.mock('../../lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: mocks.invalidateQueries,
  },
}))

const user = {
  id: 'user-1',
  email: 'utente@example.test',
} as User

const session = {
  user,
  access_token: 'access-token',
  refresh_token: 'refresh-token',
} as Session

let reload: ReturnType<typeof vi.fn>
let authCallback: ((event: string, user: User | null, session: Session | null) => void) | null

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown

  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  throw lastError
}

function installWindow(hash = '') {
  reload = vi.fn()
  vi.stubGlobal('window', {
    location: {
      hash,
      pathname: '/',
      search: '',
      href: `http://localhost/${hash}`,
      reload,
    },
    history: {
      replaceState: vi.fn(),
    },
    // authStore signals the welcome toast via a window event (see welcomeToast.ts)
    dispatchEvent: vi.fn(),
  })
  vi.stubGlobal('document', { title: 'entro' })
}

describe('authStore.initialize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authCallback = null
    localStorage.clear()
    vi.stubGlobal('sessionStorage', makeLocalStorage())
    installWindow()

    useAuthStore.setState({
      user: null,
      session: null,
      loading: true,
      isAuthenticated: false,
    })

    mocks.getSession.mockResolvedValue(session)
    mocks.getCurrentUser.mockResolvedValue(user)
    mocks.onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback
      return vi.fn()
    })
    mocks.invalidateQueries.mockResolvedValue(undefined)
    mocks.clearSignedImageCaches.mockResolvedValue(undefined)
    mocks.getUserList.mockResolvedValue({ list: { id: 'list-1' }, error: null })
  })

  it('marks an authenticated user as initialized when a list already exists', async () => {
    mocks.getUserList.mockResolvedValue({ list: { id: 'list-1' }, error: null })

    await useAuthStore.getState().initialize()

    await waitForAssertion(() => {
      expect(sessionStorage.getItem('user_initialized_utente@example.test')).toBe('true')
    })

    expect(mocks.acceptInviteByEmail).not.toHaveBeenCalled()
    expect(mocks.createPersonalList).not.toHaveBeenCalled()
    expect(mocks.invalidateQueries).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('accepts a pending invite, refreshes cached data and avoids a full reload', async () => {
    mocks.getUserList.mockResolvedValue({ list: null, error: new Error('No list') })
    mocks.acceptInviteByEmail.mockResolvedValue({ success: true, listId: 'shared-list', error: null })

    await useAuthStore.getState().initialize()

    await waitForAssertion(() => {
      expect(localStorage.getItem('show_welcome_toast')).toBe('true')
      expect(mocks.invalidateQueries).toHaveBeenCalled()
    })

    expect(sessionStorage.getItem('user_initialized_utente@example.test')).toBe('true')
    expect(mocks.createPersonalList).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('creates a personal list, refreshes cached data and avoids a full reload', async () => {
    mocks.getUserList.mockResolvedValue({ list: null, error: new Error('No list') })
    mocks.acceptInviteByEmail.mockResolvedValue({ success: false, listId: null, error: null })
    mocks.createPersonalList.mockResolvedValue({ success: true, listId: 'personal-list', error: null })

    await useAuthStore.getState().initialize()

    await waitForAssertion(() => {
      expect(mocks.createPersonalList).toHaveBeenCalled()
      expect(mocks.invalidateQueries).toHaveBeenCalled()
    })

    expect(sessionStorage.getItem('user_initialized_utente@example.test')).toBe('true')
    expect(reload).not.toHaveBeenCalled()
  })

  it('marks the user as processed when personal list creation fails', async () => {
    mocks.getUserList.mockResolvedValue({ list: null, error: new Error('No list') })
    mocks.acceptInviteByEmail.mockResolvedValue({ success: false, listId: null, error: null })
    mocks.createPersonalList.mockResolvedValue({
      success: false,
      listId: null,
      error: new Error('Create failed'),
    })

    await useAuthStore.getState().initialize()

    await waitForAssertion(() => {
      expect(sessionStorage.getItem('user_initialized_utente@example.test')).toBe('true')
    })

    expect(mocks.invalidateQueries).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not run invite or list initialization during password recovery', async () => {
    mocks.getSession.mockResolvedValue(null)
    mocks.getCurrentUser.mockResolvedValue(null)

    await useAuthStore.getState().initialize()

    expect(authCallback).toBeTypeOf('function')
    authCallback!('PASSWORD_RECOVERY', user, session)

    expect(useAuthStore.getState().user).toBe(user)
    expect(useAuthStore.getState().session).toBe(session)
    expect(mocks.getUserList).not.toHaveBeenCalled()
    expect(mocks.acceptInviteByEmail).not.toHaveBeenCalled()
    expect(mocks.createPersonalList).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  // #213: a session can end without the user pressing «Disconnetti» — revoked
  // from another device, expired, account deleted elsewhere.
  it('clears what this browser keeps of the user when the session ends on its own', async () => {
    await useAuthStore.getState().initialize()

    authCallback!('SIGNED_OUT', null, null)

    expect(mocks.clearAuthStorage).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('still signs the user out of the store when that cleanup throws', async () => {
    mocks.clearAuthStorage.mockImplementationOnce(() => {
      throw new Error('Storage disabilitato')
    })
    await useAuthStore.getState().initialize()

    expect(() => authCallback!('SIGNED_OUT', null, null)).not.toThrow()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('keeps local data and offline photos while the same session goes on', async () => {
    await useAuthStore.getState().initialize()

    authCallback!('TOKEN_REFRESHED', user, session)
    authCallback!('USER_UPDATED', user, session)

    expect(mocks.clearAuthStorage).not.toHaveBeenCalled()
    expect(mocks.clearSignedImageCaches).not.toHaveBeenCalled()
  })

  it('starts a new sign-in from an empty photo cache, without touching the new session', async () => {
    mocks.getSession.mockResolvedValue(null)
    mocks.getCurrentUser.mockResolvedValue(null)
    await useAuthStore.getState().initialize()

    authCallback!('SIGNED_IN', user, session)

    expect(mocks.clearSignedImageCaches).toHaveBeenCalledTimes(1)
    // `clearAuthStorage` would delete the `sb-*` keys just written by the sign-in.
    expect(mocks.clearAuthStorage).not.toHaveBeenCalled()
  })
})
