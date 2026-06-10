// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { validateInvite } = vi.hoisted(() => ({ validateInvite: vi.fn() }))

vi.mock('@/lib/invites', () => ({ validateInvite }))

import { AcceptInviteFlowDialog } from '../AcceptInviteFlowDialog'

function renderDialog() {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <AcceptInviteFlowDialog open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  validateInvite.mockReset()
})

describe('AcceptInviteFlowDialog — validazione codice', () => {
  it('mostra un errore inline (non un toast) per codice troppo corto, senza chiamare il backend', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByPlaceholderText('ABC123'), 'AB1')
    await user.click(screen.getByRole('button', { name: 'Continua' }))

    const err = await screen.findByRole('alert')
    expect(err.textContent).toMatch(/6 caratteri/)
    expect(validateInvite).not.toHaveBeenCalled()
  })

  it('collega l’errore al campo via aria-invalid e aria-describedby', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByPlaceholderText('ABC123'), 'AB1')
    await user.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByRole('alert')

    const input = screen.getByPlaceholderText('ABC123')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('invite-code-error')
  })

  it('cancella l’errore quando l’utente continua a digitare', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByPlaceholderText('ABC123'), 'AB1')
    await user.click(screen.getByRole('button', { name: 'Continua' }))
    await screen.findByRole('alert')

    await user.type(screen.getByPlaceholderText('ABC123'), '23')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('mostra inline il messaggio d’errore del backend per codice non valido', async () => {
    validateInvite.mockResolvedValue({ valid: false, invite: null, error: null })
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByPlaceholderText('ABC123'), 'ZZZ999')
    await user.click(screen.getByRole('button', { name: 'Continua' }))

    const err = await screen.findByRole('alert')
    expect(err.textContent).toMatch(/non valido/i)
    expect(validateInvite).toHaveBeenCalledWith('ZZZ999')
  })
})
