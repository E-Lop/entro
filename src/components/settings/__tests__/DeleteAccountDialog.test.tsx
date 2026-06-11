// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { signInWithPassword, signOut, rpc, navigateMock, clearAuthStorage, countIs } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(() => Promise.resolve({ error: null })),
  rpc: vi.fn(() => Promise.resolve({ error: null })),
  navigateMock: vi.fn(),
  clearAuthStorage: vi.fn(),
  countIs: vi.fn(() => Promise.resolve({ count: 4 })),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))
vi.mock('@/lib/auth', () => ({ clearAuthStorage }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.it' } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/haptics', () => ({ triggerHaptic: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        is: countIs,
        eq: () => ({ not: () => Promise.resolve({ data: [] }) }),
      }),
    }),
    auth: { signInWithPassword, signOut },
    rpc,
    storage: { from: () => ({ remove: vi.fn() }) },
  },
}))

import { DeleteAccountDialog } from '../DeleteAccountDialog'

const setup = () => userEvent.setup({ pointerEventsCheck: 0 })

async function openDialog(user: ReturnType<typeof setup>) {
  await user.click(screen.getByRole('button', { name: 'Elimina account' }))
  return screen.findByPlaceholderText('Inserisci password')
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DeleteAccountDialog — salvaguardie azione distruttiva', () => {
  it('mantiene il pulsante di conferma disabilitato finché la password è vuota', async () => {
    const user = setup()
    render(<DeleteAccountDialog />)

    const passwordInput = await openDialog(user)
    const confirm = screen.getByRole('button', {
      name: 'Capisco, elimina il mio account',
    }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    await user.type(passwordInput, 'secret123')
    expect(confirm.disabled).toBe(false)
  })

  it('con password errata mostra l’errore inline, tiene aperto il dialog e non naviga via', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid login' } })
    const user = setup()
    render(<DeleteAccountDialog />)

    const passwordInput = await openDialog(user)
    await user.type(passwordInput, 'wrong-password')
    await user.click(
      screen.getByRole('button', { name: 'Capisco, elimina il mio account' })
    )

    const err = await screen.findByRole('alert')
    expect(err.textContent).toMatch(/Password non corretta/)
    // Il dialog resta aperto: il campo password è ancora presente
    expect(screen.getByPlaceholderText('Inserisci password')).toBeTruthy()
    // Nessuna navigazione/cancellazione su errore
    expect(navigateMock).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('collega l’errore al campo password via aria-invalid e aria-describedby', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid login' } })
    const user = setup()
    render(<DeleteAccountDialog />)

    const passwordInput = await openDialog(user)
    await user.type(passwordInput, 'wrong-password')
    await user.click(
      screen.getByRole('button', { name: 'Capisco, elimina il mio account' })
    )
    await screen.findByRole('alert')

    const input = screen.getByPlaceholderText('Inserisci password')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('delete-password-error')
  })

  it('con 0 alimenti non rifà la fetch del conteggio alla riapertura del dialog', async () => {
    // Con un totale reale di 0, il vecchio guard `!foodCount` rifaceva la query
    // a ogni apertura. Con `foodCount === null` la fetch parte una volta sola.
    countIs.mockResolvedValue({ count: 0 })
    const user = setup()
    render(<DeleteAccountDialog />)

    // Prima apertura → parte la fetch, il conteggio (0) viene mostrato
    await openDialog(user)
    await screen.findByText(/0 totali/)
    expect(countIs).toHaveBeenCalledTimes(1)

    // Chiudi e riapri
    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    await user.click(screen.getByRole('button', { name: 'Elimina account' }))
    await screen.findByPlaceholderText('Inserisci password')

    // Nessuna nuova fetch: il conteggio 0 è già in stato (non più null)
    expect(countIs).toHaveBeenCalledTimes(1)
  })
})
