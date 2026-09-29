// @vitest-environment jsdom
/**
 * Un invito aperto da chi ha già un account passa dall'accesso a /join/CODICE
 * (#183).
 *
 * La pagina di accesso accettava l'invito da sé, con la Edge Function
 * accept-invite, che metteva l'utente nella lista dell'invito senza toglierlo
 * dalla sua: due righe in list_members, e ogni lettura della «sua» lista in
 * errore. Ora l'invito lo accetta solo /join/CODICE, con il dialogo di conferma
 * sopra join_list_via_invite. La registrazione porta il codice all'accesso,
 * e l'accesso lo porta a /join.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const { mockValidateInvite, auth, toastError } = vi.hoisted(() => ({
  mockValidateInvite: vi.fn(),
  auth: { isAuthenticated: false, loading: false },
  toastError: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastError, warning: vi.fn() } }))
vi.mock('../../lib/invites', () => ({ validateInvite: mockValidateInvite }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ ...auth, signIn: vi.fn(), signUp: vi.fn() }),
}))
// Il form vero chiama signIn e poi onSuccess: qui basta la seconda metà.
vi.mock('../../components/auth/AuthForm', () => ({
  AuthForm: ({ onSuccess }: { onSuccess?: () => void }) => (
    <button type="button" onClick={() => onSuccess?.()}>
      Entra
    </button>
  ),
}))

import { LoginPage } from '../LoginPage'
import { SignUpPage } from '../SignUpPage'

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/join/:code" element={<p>pagina join</p>} />
        <Route path="/" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>
  )
}

const fetchSpy = vi.fn()

beforeEach(() => {
  auth.isAuthenticated = false
  auth.loading = false
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('SignUpPage — il link «Accedi» porta il codice', () => {
  it('con ?code=ABC123 punta a /login?code=ABC123', async () => {
    mockValidateInvite.mockResolvedValue({ valid: true, invite: { creatorName: 'Marta' }, error: null })
    renderAt('/signup?code=ABC123')

    expect(await screen.findByRole('link', { name: 'Accedi' })).toHaveAttribute('href', '/login?code=ABC123')
  })

  it('senza codice punta a /login', () => {
    renderAt('/signup')

    expect(screen.getByRole('link', { name: 'Accedi' })).toHaveAttribute('href', '/login')
  })
})

describe('LoginPage — dopo l\'accesso l\'invito si accetta su /join', () => {
  it('con un codice valido naviga a /join/CODICE', async () => {
    mockValidateInvite.mockResolvedValue({ valid: true, invite: { creatorName: 'Marta' }, error: null })
    renderAt('/login?code=ABC123')

    expect(await screen.findByText(/Marta ti ha invitato/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Entra' }))

    expect(await screen.findByText('pagina join')).toBeInTheDocument()
  })

  it('senza codice naviga a /', async () => {
    renderAt('/login')

    await userEvent.click(screen.getByRole('button', { name: 'Entra' }))

    expect(await screen.findByText('dashboard')).toBeInTheDocument()
    expect(mockValidateInvite).not.toHaveBeenCalled()
  })

  it('con un codice non valido naviga a /, dopo il messaggio di invito non valido', async () => {
    mockValidateInvite.mockResolvedValue({ valid: false, invite: null, error: { message: 'Invito scaduto' } })
    renderAt('/login?code=ZZZ999')

    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith('Invito scaduto'))
    await userEvent.click(screen.getByRole('button', { name: 'Entra' }))

    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('nessuna chiamata va all\'endpoint accept-invite', async () => {
    mockValidateInvite.mockResolvedValue({ valid: true, invite: { creatorName: 'Marta' }, error: null })
    renderAt('/login?code=ABC123')

    await screen.findByText(/Marta ti ha invitato/)
    await userEvent.click(screen.getByRole('button', { name: 'Entra' }))
    await screen.findByText('pagina join')

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('il link «Registrati» riporta il codice alla registrazione', async () => {
    mockValidateInvite.mockResolvedValue({ valid: true, invite: { creatorName: 'Marta' }, error: null })
    renderAt('/login?code=ABC123')

    expect(screen.getByRole('link', { name: 'Registrati' })).toHaveAttribute('href', '/signup?code=ABC123')
  })

  it('chi è già autenticato e arriva con un codice valido va a /join/CODICE', async () => {
    auth.isAuthenticated = true
    mockValidateInvite.mockResolvedValue({ valid: true, invite: { creatorName: 'Marta' }, error: null })
    renderAt('/login?code=ABC123')

    expect(await screen.findByText('pagina join')).toBeInTheDocument()
  })
})
