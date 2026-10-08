// @vitest-environment jsdom
/**
 * Dove finisce l'utente quando preme «Disconnetti» (#81).
 *
 * Il caso che conta non è il logout riuscito: è quello in cui `signOut()`
 * ritorna errore. `supabaseSignOutEvents.test.ts` stabilisce che in quel caso
 * supabase-js **non** emette `SIGNED_OUT` — quindi `authStore` resta pieno e
 * `ProtectedRoute` non porta al login da solo. Se non naviga questo
 * componente, l'utente resta sulla dashboard a guardare i dati di una
 * sessione che non esiste più.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { navigateMock, signOutMock, invitesMock, toastMock, localMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signOutMock: vi.fn(),
  invitesMock: {
    getUserList: vi.fn(),
    getListMembers: vi.fn(),
    getRemovableMembers: vi.fn(),
    peekRemovalNotice: vi.fn(),
    takeRemovalNotice: vi.fn(),
  },
  toastMock: { info: vi.fn() },
  localMock: { clear: vi.fn(), clearPersistedCache: vi.fn(), clearSignedImageCaches: vi.fn() },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  Outlet: () => <div data-testid="content" />,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'utente@example.com', user_metadata: {} },
    signOut: signOutMock,
  }),
}))

// Il layout monta l'intera famiglia delle condivisioni: qui non è in prova, e
// montarla davvero trascinerebbe dentro Supabase e React Query.
vi.mock('../../../lib/invites', () => invitesMock)
vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@/lib/queryClient', () => ({ queryClient: { clear: localMock.clear } }))
vi.mock('@/lib/queryPersister', () => ({ clearPersistedCache: localMock.clearPersistedCache }))
vi.mock('@/lib/signedImageCache', () => ({ clearSignedImageCaches: localMock.clearSignedImageCaches }))
vi.mock('../../guide/QuickGuideDialog', () => ({ QuickGuideDialog: () => null }))
vi.mock('../../sharing/InviteMenuItem', () => ({ InviteMenuItem: () => null }))
vi.mock('../../sharing/InviteDialog', () => ({ InviteDialog: () => null }))
vi.mock('../../sharing/InviteMenuDialog', () => ({ InviteMenuDialog: () => null }))
vi.mock('../../sharing/AcceptInviteFlowDialog', () => ({
  AcceptInviteFlowDialog: () => null,
}))
vi.mock('../../sharing/LeaveListDialog', () => ({ LeaveListDialog: () => null }))
vi.mock('../../sharing/RemoveMemberDialog', () => ({ RemoveMemberDialog: () => null }))
vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => null }))
vi.mock('../../ui/AppIcon', () => ({ AppIcon: () => null }))

import { AppLayout } from '../AppLayout'

const setup = () => userEvent.setup({ pointerEventsCheck: 0 })

/** Apre il menu utente e ritorna la voce «Disconnetti». */
async function openUserMenu(user: ReturnType<typeof setup>) {
  await user.click(screen.getByRole('button', { name: 'Menu utente' }))
  return screen.findByText('Disconnetti')
}

beforeEach(() => {
  invitesMock.getUserList.mockResolvedValue({ list: null })
  invitesMock.getListMembers.mockResolvedValue({ members: [] })
  invitesMock.getRemovableMembers.mockResolvedValue({ members: [], error: null })
  invitesMock.peekRemovalNotice.mockResolvedValue(null)
  invitesMock.takeRemovalNotice.mockResolvedValue(false)
  localMock.clearPersistedCache.mockResolvedValue(undefined)
  localMock.clearSignedImageCaches.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('AppLayout — uscita', () => {
  it('porta al login quando il logout riesce', async () => {
    signOutMock.mockResolvedValue({
      success: true,
      error: null,
      localSessionCleared: true,
    })
    const user = setup()
    render(<AppLayout />)

    await user.click(await openUserMenu(user))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
    })
    expect(navigateMock).toHaveBeenCalledTimes(1)
  })

  it('porta al login anche quando Supabase rifiuta, se la pulizia locale è riuscita', async () => {
    signOutMock.mockResolvedValue({
      success: false,
      error: new Error('Failed to fetch'),
      localSessionCleared: true,
    })
    const user = setup()
    render(<AppLayout />)

    await user.click(await openUserMenu(user))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
    })
  })

  it('non butta fuori l’utente se la pulizia locale è fallita', async () => {
    // Storage bloccato dal browser: i token possono essere ancora lì, quindi
    // mandarlo al login mentirebbe sullo stato del dispositivo.
    signOutMock.mockResolvedValue({
      success: false,
      error: new Error('Storage disabilitato'),
      localSessionCleared: false,
    })
    const user = setup()
    render(<AppLayout />)

    await user.click(await openUserMenu(user))

    await waitFor(() => expect(signOutMock).toHaveBeenCalled())
    expect(navigateMock).not.toHaveBeenCalled()
  })
})

// #196: chi è stato tolto da una lista con l'app chiusa lo scopre alla
// riapertura. `takeRemovalNotice` legge e cancella l'avviso, quindi `true`
// arriva una volta sola.
describe('AppLayout — avviso a chi è stato tolto da una lista', () => {
  const NOTICE = 'Non fai più parte della lista condivisa. I tuoi alimenti sono rimasti lì.'

  it('lo mostra, e resta finché l’utente non lo chiude', async () => {
    invitesMock.getUserList.mockResolvedValue({ list: { id: 'lista-nuova' } })
    invitesMock.takeRemovalNotice.mockResolvedValue(true)

    render(<AppLayout />)

    await waitFor(() => expect(toastMock.info).toHaveBeenCalledTimes(1))
    expect(toastMock.info).toHaveBeenCalledWith(NOTICE, { duration: Infinity, closeButton: true })
    expect(invitesMock.takeRemovalNotice).toHaveBeenCalledWith('u1', 'lista-nuova')
    // Le foto della lista di prima non restano su questo dispositivo.
    expect(localMock.clearSignedImageCaches).toHaveBeenCalledTimes(1)
  })

  it('senza avviso non dice niente', async () => {
    invitesMock.getUserList.mockResolvedValue({ list: { id: 'lista-nuova' } })

    render(<AppLayout />)

    await waitFor(() => expect(invitesMock.takeRemovalNotice).toHaveBeenCalled())
    expect(toastMock.info).not.toHaveBeenCalled()
    expect(localMock.clearSignedImageCaches).not.toHaveBeenCalled()
  })
})

// Deciso l'8 ott 2026: niente realtime. Chi viene tolto con l'app aperta lo
// scopre tornando in primo piano: la pagina riparte, e l'avviso lo mostra
// l'apertura.
describe('AppLayout — tolto da una lista con l’app aperta', () => {
  let reload: ReturnType<typeof vi.fn>

  async function mountThenReturn() {
    render(<AppLayout />)
    await waitFor(() => expect(invitesMock.takeRemovalNotice).toHaveBeenCalled())
    invitesMock.takeRemovalNotice.mockClear()
    document.dispatchEvent(new Event('visibilitychange'))
  }

  beforeEach(() => {
    reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    invitesMock.getUserList.mockResolvedValue({ list: { id: 'lista-nuova' } })
  })

  it('tornando in primo piano con un avviso: via i dati della lista di prima, e la pagina riparte', async () => {
    invitesMock.peekRemovalNotice.mockResolvedValue({ listId: 'lista-di-prima' })

    await mountThenReturn()

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(localMock.clear).toHaveBeenCalled()
    expect(localMock.clearPersistedCache).toHaveBeenCalled()
    expect(localMock.clearSignedImageCaches).toHaveBeenCalled()
    // L'avviso non si consuma qui: lo mostra l'apertura dopo il ricaricamento.
    expect(invitesMock.takeRemovalNotice).not.toHaveBeenCalled()
  })

  it('senza avviso tornare in primo piano non fa niente', async () => {
    await mountThenReturn()
    await waitFor(() => expect(invitesMock.peekRemovalNotice).toHaveBeenCalled())

    expect(reload).not.toHaveBeenCalled()
    expect(localMock.clear).not.toHaveBeenCalled()
  })

  it('chi nel frattempo è rientrato nella stessa lista non viene ricaricato: l’avviso sparisce e basta', async () => {
    invitesMock.peekRemovalNotice.mockResolvedValue({ listId: 'lista-nuova' })

    await mountThenReturn()

    await waitFor(() => expect(invitesMock.takeRemovalNotice).toHaveBeenCalledWith('u1', 'lista-nuova'))
    expect(reload).not.toHaveBeenCalled()
  })
})
