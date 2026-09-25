// @vitest-environment jsdom
/**
 * La card Account ha «Esci dagli altri dispositivi» (#143): chi perde un
 * telefono lo chiude da qui, senza passare dal recupero password.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const { mockSignOutOthers, toastSuccess, toastError } = vi.hoisted(() => ({
  mockSignOutOthers: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ signOutOtherDevices: mockSignOutOthers }))
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'a@example.test', user_metadata: { full_name: 'Anna' } } }),
}))
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

import { AccountSection } from '../AccountSection'

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('AccountSection — esci dagli altri dispositivi', () => {
  it('spiega cosa fa, sotto il pulsante', () => {
    render(<AccountSection />)
    expect(screen.getByRole('button', { name: 'Esci dagli altri dispositivi' })).toBeEnabled()
    expect(
      screen.getByText("Chiude l'accesso a entro su tutti gli altri telefoni e browser. Su questo resti dentro.")
    ).toBeInTheDocument()
  })

  it('riuscita: conferma con un toast', async () => {
    mockSignOutOthers.mockResolvedValue({ error: null })
    render(<AccountSection />)

    await userEvent.click(screen.getByRole('button', { name: 'Esci dagli altri dispositivi' }))

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Accesso chiuso sugli altri dispositivi'))
    expect(toastError).not.toHaveBeenCalled()
  })

  it('fallita: mostra l\'errore', async () => {
    mockSignOutOthers.mockResolvedValue({ error: new Error('Qualcosa è andato storto, riprova') })
    render(<AccountSection />)

    await userEvent.click(screen.getByRole('button', { name: 'Esci dagli altri dispositivi' }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Qualcosa è andato storto, riprova'))
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('durante la chiamata il pulsante è disabilitato e lo dice', async () => {
    let resolve!: (v: unknown) => void
    mockSignOutOthers.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<AccountSection />)

    await userEvent.click(screen.getByRole('button', { name: 'Esci dagli altri dispositivi' }))

    const busy = await screen.findByRole('button', { name: 'Uscita in corso…' })
    expect(busy).toBeDisabled()
    resolve({ error: null })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Esci dagli altri dispositivi' })).toBeEnabled())
  })
})
