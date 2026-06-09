// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { AuthForm } from '../AuthForm'

const { mockSignIn, mockSignUp } = vi.hoisted(() => ({
  mockSignIn: vi.fn(),
  mockSignUp: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ signIn: mockSignIn, signUp: mockSignUp }),
}))

describe('AuthForm — accessibilità ed errori', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('il toggle password ha un nome accessibile ed è raggiungibile da tastiera', async () => {
    render(<AuthForm mode="login" />)

    const toggle = screen.getByRole('button', { name: /mostra password/i })
    expect(toggle).toBeInTheDocument()
    // P2 fix: non più tabIndex={-1}
    expect(toggle).not.toHaveAttribute('tabindex', '-1')

    await userEvent.click(toggle)
    expect(
      screen.getByRole('button', { name: /nascondi password/i })
    ).toBeInTheDocument()
  })

  it('mostra un errore inline persistente (role=alert) quando il login fallisce', async () => {
    mockSignIn.mockResolvedValue({
      success: false,
      error: new Error('Credenziali non valide'),
    })

    render(<AuthForm mode="login" />)
    await userEvent.type(screen.getByPlaceholderText('tua@email.com'),'mario@example.com')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'qualsiasi')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Credenziali non valide')
  })

  it('non chiama signIn quando la email non è valida (la validazione blocca il submit)', async () => {
    render(<AuthForm mode="login" />)
    await userEvent.type(screen.getByPlaceholderText('tua@email.com'), 'non-una-email')
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'qualsiasi')
    await userEvent.click(screen.getByRole('button', { name: 'Accedi' }))

    // Con una email valida signIn verrebbe chiamata (vedi test sopra): diamo tempo
    // al resolver async, poi verifichiamo che NON sia stata invocata.
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(mockSignIn).not.toHaveBeenCalled()
  })
})
