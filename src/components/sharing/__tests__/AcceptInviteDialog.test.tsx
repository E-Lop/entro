// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { accept } = vi.hoisted(() => ({ accept: vi.fn() }))

vi.mock('../../../lib/invites', () => ({ acceptInviteWithConfirmation: accept }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AcceptInviteDialog } from '../AcceptInviteDialog'

/**
 * #147 — l'avviso prima di accettare un invito dice ciò che succede davvero.
 *
 * Da unico membro la lista si cancella con i suoi alimenti; da una lista
 * condivisa resta agli altri membri, e non c'è nessuna perdita da annunciare.
 */

async function askToJoin(confirmation: { foodCount: number; onlyMember: boolean | null }) {
  accept.mockResolvedValueOnce({ success: false, listId: null, requiresConfirmation: true, error: null, ...confirmation })
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AcceptInviteDialog open onOpenChange={() => {}} shortCode="ABC123" />
    </QueryClientProvider>
  )
  await user.click(screen.getByRole('button', { name: 'Unisciti' }))
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AcceptInviteDialog — l’avviso prima di lasciare la lista', () => {
  it('da unico membro annuncia l’eliminazione degli alimenti in lista, con il numero', async () => {
    await askToJoin({ foodCount: 2, onlyMember: true })

    expect(await screen.findByText(/Perdita dati/)).toBeTruthy()
    expect(screen.getByText(/2 alimenti/)).toBeTruthy()
    expect(screen.getByText(/eliminati definitivamente/)).toBeTruthy()
  })

  it('usa il singolare con un alimento solo', async () => {
    await askToJoin({ foodCount: 1, onlyMember: true })

    expect(await screen.findByText(/1 alimento\b/)).toBeTruthy()
  })

  it('da una lista condivisa dice che gli alimenti restano agli altri, e non annuncia nessuna perdita', async () => {
    await askToJoin({ foodCount: 7, onlyMember: false })

    expect(await screen.findByText(/Lascerai la lista condivisa/)).toBeTruthy()
    expect(screen.getByText(/restano nella lista per gli altri membri/)).toBeTruthy()
    expect(screen.queryByText(/Perdita dati/)).toBeNull()
    expect(screen.queryByText(/eliminat/)).toBeNull()
    expect(screen.queryByText(/7/)).toBeNull()
  })

  it('senza l’informazione (server di prima della #147) avvisa della perdita, come prima', async () => {
    await askToJoin({ foodCount: 3, onlyMember: null })

    expect(await screen.findByText(/Perdita dati/)).toBeTruthy()
    expect(screen.getByText(/eliminati definitivamente/)).toBeTruthy()
  })

  it('in entrambi i casi la conferma resta un passo esplicito', async () => {
    await askToJoin({ foodCount: 2, onlyMember: false })

    expect(await screen.findByRole('button', { name: 'Conferma e unisciti' })).toBeTruthy()
    expect(accept).toHaveBeenCalledTimes(1)
  })
})
