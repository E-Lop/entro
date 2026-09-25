// @vitest-environment jsdom
/**
 * Con un codice invito nell'URL, «Registrati» aspetta che il codice sia
 * validato (#165).
 *
 * La validazione è asincrona. Se il form parte prima che finisca, il codice
 * non viaggia con la registrazione e l'utente nasce in una lista sua invece che
 * in quella di chi l'ha invitato: l'E2E della #165 lo ha preso in CI, una volta
 * su due.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'

const { mockValidateInvite } = vi.hoisted(() => ({ mockValidateInvite: vi.fn() }))

vi.mock('@/lib/invites', () => ({ validateInvite: mockValidateInvite }))
vi.mock('../../lib/invites', () => ({ validateInvite: mockValidateInvite }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false, loading: false, signIn: vi.fn(), signUp: vi.fn() }),
}))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false, loading: false, signIn: vi.fn(), signUp: vi.fn() }),
}))

import { SignUpPage } from '../SignUpPage'

afterEach(cleanup)

describe('SignUpPage — codice invito nell\'URL', () => {
  it('«Registrati» resta disabilitato finché il codice non è validato', async () => {
    let resolve!: (v: unknown) => void
    mockValidateInvite.mockReturnValue(new Promise((r) => { resolve = r }))

    render(
      <MemoryRouter initialEntries={['/signup?code=AB12CD']}>
        <SignUpPage />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole('checkbox'))

    expect(screen.getByRole('button', { name: 'Registrati' })).toBeDisabled()

    await act(async () => {
      resolve({ valid: true, invite: { creatorName: 'Marta' }, error: null })
    })

    expect(screen.getByRole('button', { name: 'Registrati' })).toBeEnabled()
  })
})
