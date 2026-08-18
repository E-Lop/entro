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
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { navigateMock, signOutMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  Outlet: () => <div data-testid="contenuto" />,
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
vi.mock('../../../lib/invites', () => ({
  getUserList: vi.fn(async () => ({ list: null })),
  getListMembers: vi.fn(async () => ({ members: [] })),
}))
vi.mock('../../guide/QuickGuideDialog', () => ({ QuickGuideDialog: () => null }))
vi.mock('../../sharing/InviteMenuItem', () => ({ InviteMenuItem: () => null }))
vi.mock('../../sharing/InviteDialog', () => ({ InviteDialog: () => null }))
vi.mock('../../sharing/InviteMenuDialog', () => ({ InviteMenuDialog: () => null }))
vi.mock('../../sharing/AcceptInviteFlowDialog', () => ({
  AcceptInviteFlowDialog: () => null,
}))
vi.mock('../../sharing/LeaveListDialog', () => ({ LeaveListDialog: () => null }))
vi.mock('../ThemeToggle', () => ({ ThemeToggle: () => null }))
vi.mock('../../ui/AppIcon', () => ({ AppIcon: () => null }))

import { AppLayout } from '../AppLayout'

const setup = () => userEvent.setup({ pointerEventsCheck: 0 })

/** Apre il menu utente e ritorna la voce «Disconnetti». */
async function apriMenuUtente(user: ReturnType<typeof setup>) {
  await user.click(screen.getByRole('button', { name: 'Menu utente' }))
  return screen.findByText('Disconnetti')
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
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

    await user.click(await apriMenuUtente(user))

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

    await user.click(await apriMenuUtente(user))

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

    await user.click(await apriMenuUtente(user))

    await waitFor(() => expect(signOutMock).toHaveBeenCalled())
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
