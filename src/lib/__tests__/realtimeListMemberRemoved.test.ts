// @vitest-environment jsdom
/**
 * Essere tolti da una lista: il dispositivo perde l'accesso alle sue foto, e
 * la cache del service worker non deve continuare a servirle (#213).
 */
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockClearSignedImageCaches } = vi.hoisted(() => ({
  mockClearSignedImageCaches: vi.fn(),
}))

vi.mock('@/lib/signedImageCache', () => ({ clearSignedImageCaches: mockClearSignedImageCaches }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), info: vi.fn() } }))
vi.mock('@/hooks/useFoods', () => ({
  foodsKeys: { lists: () => ['foods', 'list'], detail: (id: string) => ['foods', 'detail', id] },
}))

import { handleListMemberDelete } from '@/lib/realtime'
import type { ListMemberRealtimePayload } from '@/lib/realtime.types'

const removal = (userId: string) => ({ old: { user_id: userId } }) as ListMemberRealtimePayload

let queryClient: QueryClient

beforeEach(() => {
  vi.useFakeTimers()
  mockClearSignedImageCaches.mockReset()
  mockClearSignedImageCaches.mockResolvedValue(undefined)
  queryClient = new QueryClient()
})

afterEach(() => {
  // Il reindirizzamento è in un `setTimeout`: non deve partire sotto jsdom.
  vi.clearAllTimers()
  vi.useRealTimers()
  queryClient.clear()
})

describe('rimozione da una lista e cache delle foto', () => {
  it('se a essere tolto è chi usa questo dispositivo, la cache delle foto si svuota', () => {
    handleListMemberDelete(removal('io'), queryClient, 'io')

    expect(mockClearSignedImageCaches).toHaveBeenCalledTimes(1)
  })

  it('se esce un altro membro le foto restano: l\'accesso non è cambiato', () => {
    handleListMemberDelete(removal('un-altro'), queryClient, 'io')

    expect(mockClearSignedImageCaches).not.toHaveBeenCalled()
  })

  it('una cache che non si svuota non ferma la gestione della rimozione', () => {
    mockClearSignedImageCaches.mockRejectedValue(new Error('Cache bloccata'))

    expect(() => handleListMemberDelete(removal('io'), queryClient, 'io')).not.toThrow()
  })
})
