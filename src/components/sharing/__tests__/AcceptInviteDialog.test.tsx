// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { accept, clearListData } = vi.hoisted(() => ({ accept: vi.fn(), clearListData: vi.fn() }))

vi.mock('../../../lib/invites', () => ({ acceptInviteWithConfirmation: accept }))
vi.mock('../../../lib/listDataCleanup', () => ({ clearListData }))
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

/**
 * #240 — chi accetta confermando di lasciare la sua lista perde l'accesso a
 * quella lista, e il dispositivo deve dimenticarla come negli altri momenti
 * (Regola 2 di `local-data-when-access-ends.md`). Il server chiede la conferma
 * ogni volta che l'utente ha già una lista diversa, quindi l'accettazione con
 * conferma è proprio il caso in cui si lascia una lista.
 */
describe('AcceptInviteDialog — ciò che resta della lista lasciata', () => {
  function mount(onSuccess: () => void) {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AcceptInviteDialog open onOpenChange={() => {}} shortCode="ABC123" onSuccess={onSuccess} />
      </QueryClientProvider>
    )
  }

  it('accettato con conferma: la pulizia della lista lasciata, prima di proseguire', async () => {
    clearListData.mockResolvedValue(undefined)
    accept
      .mockResolvedValueOnce({ success: false, listId: null, requiresConfirmation: true, foodCount: 2, onlyMember: false, error: null })
      .mockResolvedValueOnce({ success: true, listId: 'lista-nuova', requiresConfirmation: false, error: null })
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    mount(onSuccess)

    await user.click(screen.getByRole('button', { name: 'Unisciti' }))
    await user.click(await screen.findByRole('button', { name: 'Conferma e unisciti' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(accept).toHaveBeenLastCalledWith('ABC123', true)
    expect(clearListData).toHaveBeenCalledTimes(1)
    expect(clearListData.mock.invocationCallOrder[0]).toBeLessThan(onSuccess.mock.invocationCallOrder[0])
  })

  it('accettato senza conferma, da chi non aveva una lista: niente da dimenticare', async () => {
    accept.mockResolvedValueOnce({ success: true, listId: 'lista-nuova', requiresConfirmation: false, error: null })
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    mount(onSuccess)

    await user.click(screen.getByRole('button', { name: 'Unisciti' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(clearListData).not.toHaveBeenCalled()
  })
})
