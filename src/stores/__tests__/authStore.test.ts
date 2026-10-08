import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'
import { makeLocalStorage } from '../../test/localStorage'
import { useAuthStore } from '../authStore'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getCurrentUser: vi.fn(),
  readStoredSession: vi.fn(),
  verifySession: vi.fn(),
  signOut: vi.fn(),
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
  readStoredSession: mocks.readStoredSession,
  verifySession: mocks.verifySession,
  signOut: mocks.signOut,
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
    mocks.readStoredSession.mockReturnValue(session)
    mocks.verifySession.mockResolvedValue('valid')
    mocks.signOut.mockResolvedValue({ error: null, localSessionCleared: true })
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
    mocks.readStoredSession.mockReturnValue(null)

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
    mocks.readStoredSession.mockReturnValue(null)
    await useAuthStore.getState().initialize()

    authCallback!('SIGNED_IN', user, session)

    expect(mocks.clearSignedImageCaches).toHaveBeenCalledTimes(1)
    // `clearAuthStorage` would delete the `sb-*` keys just written by the sign-in.
    expect(mocks.clearAuthStorage).not.toHaveBeenCalled()
  })

  // #216: fra dashboard e login decide la sessione salvata, non la rete.
  describe('avvio con il server irraggiungibile (#216)', () => {
    /** Una richiesta che non torna mai: il server non risponde. */
    const never = () => new Promise<never>(() => {})

    it('con una sessione salvata si è dentro senza aspettare la risposta di rete', async () => {
      mocks.verifySession.mockImplementation(never)
      mocks.getSession.mockImplementation(never)
      mocks.getCurrentUser.mockImplementation(never)

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, loading: false, user, session })
    })

    it('una sessione vuota dal listener non è un’uscita, se non è SIGNED_OUT', async () => {
      // Token scaduto e server fermo: auth-js consegna `INITIAL_SESSION` con
      // `null` e lascia la sessione in archivio.
      mocks.verifySession.mockImplementation(never)
      await useAuthStore.getState().initialize()

      authCallback!('INITIAL_SESSION', null, null)

      expect(useAuthStore.getState().isAuthenticated).toBe(true)
      expect(mocks.clearAuthStorage).not.toHaveBeenCalled()
    })

    it('se il server non si pronuncia si resta dentro', async () => {
      mocks.verifySession.mockResolvedValue('unknown')

      await useAuthStore.getState().initialize()
      await waitForAssertion(() => expect(mocks.verifySession).toHaveBeenCalled())

      expect(useAuthStore.getState().isAuthenticated).toBe(true)
      expect(mocks.signOut).not.toHaveBeenCalled()
    })

    it('se il server rifiuta la sessione si esce, con la pulizia di «Disconnetti»', async () => {
      mocks.verifySession.mockResolvedValue('rejected')

      await useAuthStore.getState().initialize()

      await waitForAssertion(() => {
        expect(mocks.signOut).toHaveBeenCalledTimes(1)
        expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, user: null, session: null })
      })
    })

    it('un rifiuto arrivato tardi non fa uscire chi nel frattempo è entrato con un altro account', async () => {
      let answer: (verdict: string) => void = () => {}
      mocks.verifySession.mockImplementation(() => new Promise((resolve) => (answer = resolve)))
      await useAuthStore.getState().initialize()

      const other = { id: 'user-2', email: 'altro@example.test' } as User
      authCallback!('SIGNED_OUT', null, null)
      authCallback!('SIGNED_IN', other, { ...session, user: other })
      answer('rejected')
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mocks.signOut).not.toHaveBeenCalled()
      expect(useAuthStore.getState().user).toBe(other)
    })

    it('senza una sessione salvata: login, e al server non si chiede niente', async () => {
      mocks.readStoredSession.mockReturnValue(null)
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

      await useAuthStore.getState().initialize()

      expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, loading: false })
      expect(mocks.verifySession).not.toHaveBeenCalled()
      expect(mocks.getCurrentUser).not.toHaveBeenCalled()
      expect(logged).not.toHaveBeenCalled()
      logged.mockRestore()
    })

    it('se la lista dell’utente non si prepara per colpa della rete, si resta dentro', async () => {
      const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
      mocks.verifySession.mockResolvedValue('unknown')
      mocks.getUserList.mockRejectedValue(new TypeError('Failed to fetch'))

      await useAuthStore.getState().initialize()
      await waitForAssertion(() => expect(logged).toHaveBeenCalled())

      expect(useAuthStore.getState().isAuthenticated).toBe(true)
      logged.mockRestore()
    })
  })

  // Password reset e magic link: la sessione non è in archivio, è nell'URL, e
  // la legge auth-js. Lì si aspetta lui, come prima della #216.
  describe('avvio con i token nell’URL', () => {
    beforeEach(() => {
      installWindow('#access_token=abc&refresh_token=def&type=recovery')
      mocks.readStoredSession.mockReturnValue(null)
    })

    it('la sessione viene da auth-js, e i token spariscono dall’URL dopo che li ha letti', async () => {
      let read: (value: Session) => void = () => {}
      mocks.getSession.mockImplementation(() => new Promise((resolve) => (read = resolve)))

      const started = useAuthStore.getState().initialize()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(useAuthStore.getState().loading).toBe(true)
      expect(window.history.replaceState).not.toHaveBeenCalled()

      read(session)
      await started

      expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: true, loading: false, user })
      expect(window.history.replaceState).toHaveBeenCalledWith({}, 'entro', '/')
      expect(mocks.verifySession).not.toHaveBeenCalled()
    })
  })
})
