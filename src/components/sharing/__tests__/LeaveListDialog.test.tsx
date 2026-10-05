// @vitest-environment jsdom
/**
 * Abbandonare una lista condivisa: le foto degli altri membri non devono
 * restare nella cache del service worker di questo dispositivo (#213).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { leaveSharedList, clearSignedImageCaches } = vi.hoisted(() => ({
  leaveSharedList: vi.fn(),
  clearSignedImageCaches: vi.fn(),
}))

vi.mock('@/lib/invites', () => ({ leaveSharedList }))
vi.mock('@/lib/signedImageCache', () => ({ clearSignedImageCaches }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/useFoods', () => ({ foodsKeys: { all: ['foods'] } }))

import { LeaveListDialog } from '../LeaveListDialog'

let queryClient: QueryClient

async function confirmLeave() {
  queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <LeaveListDialog open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
  await userEvent.setup().click(screen.getByRole('button', { name: /Abbandona/ }))
}

beforeEach(() => {
  clearSignedImageCaches.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  leaveSharedList.mockReset()
  clearSignedImageCaches.mockReset()
})

describe('LeaveListDialog — la cache delle foto', () => {
  it('uscita riuscita: la cache delle foto si svuota, e di nuovo prima del reload', async () => {
    leaveSharedList.mockResolvedValue({ success: true, error: null })

    await confirmLeave()

    // Subito, e poi quando la pagina sta per ricaricarsi: finché le card della
    // lista lasciata sono a schermo una foto può rientrare in cache.
    await waitFor(() => expect(clearSignedImageCaches).toHaveBeenCalledTimes(2))
  })

  it('uscita rifiutata: l\'utente è ancora nella lista, e le foto restano', async () => {
    leaveSharedList.mockResolvedValue({ success: false, error: new Error('Sei l\'unico membro') })

    await confirmLeave()

    await waitFor(() => expect(leaveSharedList).toHaveBeenCalledTimes(1))
    expect(clearSignedImageCaches).not.toHaveBeenCalled()
  })

  it('una cache che non si svuota non impedisce di uscire', async () => {
    leaveSharedList.mockResolvedValue({ success: true, error: null })
    clearSignedImageCaches.mockRejectedValue(new Error('Cache bloccata'))
    const onOpenChange = vi.fn()
    queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <LeaveListDialog open onOpenChange={onOpenChange} />
      </QueryClientProvider>
    )

    await userEvent.setup().click(screen.getByRole('button', { name: /Abbandona/ }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
