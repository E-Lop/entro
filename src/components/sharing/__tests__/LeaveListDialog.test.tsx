// @vitest-environment jsdom
/**
 * Abbandonare una lista condivisa: ciò che il dispositivo tiene della lista
 * lasciata sparisce, foto comprese (#213), con la pulizia unica della Regola 2
 * di `local-data-when-access-ends.md` (#240). Prima la cache persistita restava,
 * e la ricarica la ripristinava.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { leaveSharedList, clearListData } = vi.hoisted(() => ({
  leaveSharedList: vi.fn(),
  clearListData: vi.fn(),
}))

vi.mock('@/lib/invites', () => ({ leaveSharedList }))
vi.mock('@/lib/listDataCleanup', () => ({ clearListData }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { LeaveListDialog } from '../LeaveListDialog'

let queryClient: QueryClient
let reload: ReturnType<typeof vi.fn>

async function confirmLeave(onOpenChange: (open: boolean) => void = () => {}) {
  queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <LeaveListDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>
  )
  await userEvent.setup().click(screen.getByRole('button', { name: /Abbandona/ }))
}

beforeEach(() => {
  clearListData.mockResolvedValue(undefined)
  reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  leaveSharedList.mockReset()
  clearListData.mockReset()
  vi.unstubAllGlobals()
})

describe('LeaveListDialog — ciò che resta della lista lasciata', () => {
  it('uscita riuscita: la pulizia della lista, poi la pagina riparte', async () => {
    leaveSharedList.mockResolvedValue({ success: true, error: null })
    const onOpenChange = vi.fn()

    await confirmLeave(onOpenChange)

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(clearListData).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('la pagina riparte solo a pulizia finita', async () => {
    leaveSharedList.mockResolvedValue({ success: true, error: null })
    let finishCleanup: () => void = () => {}
    clearListData.mockReturnValue(new Promise<void>((resolve) => (finishCleanup = resolve)))

    await confirmLeave()

    await waitFor(() => expect(clearListData).toHaveBeenCalled())
    expect(reload).not.toHaveBeenCalled()
    finishCleanup()
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('uscita rifiutata: l\'utente è ancora nella lista, e niente si svuota', async () => {
    leaveSharedList.mockResolvedValue({ success: false, error: new Error('Sei l\'unico membro') })

    await confirmLeave()

    await waitFor(() => expect(leaveSharedList).toHaveBeenCalledTimes(1))
    expect(clearListData).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})
