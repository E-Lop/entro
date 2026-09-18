// @vitest-environment jsdom
/**
 * Le signed URL passano da React Query, una voce per percorso, e i percorsi
 * chiesti nello stesso giro partono in una richiesta sola (#119).
 *
 * Prima l'hook teneva lo stato con `useState` e `useEffect`: N card, N
 * richieste, rifatte a ogni cambio di vista. Misurato sul browser il 18 set
 * 2026: quattro card, otto richieste in sviluppo, e altre otto a ogni
 * passaggio Calendario → Lista.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mocks } = vi.hoisted(() => ({
  mocks: { getSignedImageUrls: vi.fn(), getPendingImage: vi.fn(), logError: vi.fn() },
}))

vi.mock('@/lib/storage', () => ({ getSignedImageUrls: mocks.getSignedImageUrls }))
vi.mock('@/lib/pendingImages', () => ({
  getPendingImage: mocks.getPendingImage,
  isPendingUrl: (ref: string | null | undefined) => !!ref?.startsWith('pending://'),
}))
vi.mock('@/lib/safeLog', () => ({ logError: mocks.logError }))

import { usePrefetchSignedUrls, useSignedUrl } from '../useSignedUrl'

const urlOf = (path: string) => `https://ref.supabase.co/sign/${path}?token=t`

let queryClient: QueryClient

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

/** Tre card montate nello stesso render, come le monta la lista. */
function mountCards(refs: (string | null)[]) {
  return renderHook(() => refs.map((ref) => useSignedUrl(ref)), { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mocks.getSignedImageUrls.mockImplementation(async (paths: string[]) =>
    new Map(paths.filter((p) => !p.includes('sparita')).map((p) => [p, urlOf(p)]))
  )
})

afterEach(() => {
  cleanup()
  queryClient.clear()
})

describe('useSignedUrl', () => {
  it('le card montate insieme fanno una richiesta sola, con tutti i percorsi', async () => {
    const { result } = mountCards(['u/a.jpg', 'u/b.jpg', 'u/c.jpg'])

    await waitFor(() => expect(result.current.every((r) => r.signedUrl)).toBe(true))

    expect(mocks.getSignedImageUrls).toHaveBeenCalledTimes(1)
    expect(mocks.getSignedImageUrls).toHaveBeenCalledWith(['u/a.jpg', 'u/b.jpg', 'u/c.jpg'], 3600)
    expect(result.current.map((r) => r.signedUrl)).toEqual(['u/a.jpg', 'u/b.jpg', 'u/c.jpg'].map(urlOf))
  })

  it('mentre aspetta dice che sta caricando', async () => {
    const { result } = mountCards(['u/a.jpg'])

    expect(result.current[0]).toMatchObject({ signedUrl: null, isLoading: true, error: null })
    await waitFor(() => expect(result.current[0].isLoading).toBe(false))
  })

  it('un oggetto che manca vale «nessuna foto»: non è un errore e non ferma gli altri', async () => {
    const { result } = mountCards(['u/a.jpg', 'u/sparita.jpg'])

    await waitFor(() => expect(result.current.every((r) => !r.isLoading)).toBe(true))

    expect(result.current[0].signedUrl).toBe(urlOf('u/a.jpg'))
    expect(result.current[1]).toMatchObject({ signedUrl: null, isLoading: false, error: null })
    expect(mocks.logError).not.toHaveBeenCalled()
  })

  it('se fallisce la chiamata intera, ogni card del giro ha il suo errore', async () => {
    mocks.getSignedImageUrls.mockRejectedValue(new Error('Errore durante il recupero delle immagini'))

    const { result } = mountCards(['u/a.jpg', 'u/b.jpg'])

    await waitFor(() => expect(result.current.every((r) => r.error)).toBe(true))
    expect(result.current.map((r) => r.signedUrl)).toEqual([null, null])
    expect(mocks.getSignedImageUrls).toHaveBeenCalledTimes(1)
  })

  it('rimontare le card con le URL ancora fresche non rifà nessuna richiesta', async () => {
    const first = mountCards(['u/a.jpg', 'u/b.jpg'])
    await waitFor(() => expect(first.result.current.every((r) => r.signedUrl)).toBe(true))
    first.unmount()

    const second = mountCards(['u/a.jpg', 'u/b.jpg'])

    expect(second.result.current.map((r) => r.signedUrl)).toEqual(['u/a.jpg', 'u/b.jpg'].map(urlOf))
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(mocks.getSignedImageUrls).toHaveBeenCalledTimes(1)
  })

  it('lo stesso percorso nella card e nel form è una voce sola', async () => {
    const { result } = mountCards(['u/a.jpg', 'u/a.jpg'])

    await waitFor(() => expect(result.current.every((r) => r.signedUrl)).toBe(true))

    expect(mocks.getSignedImageUrls).toHaveBeenCalledWith(['u/a.jpg'], 3600)
  })

  // `core/food-images.md`: alcune righe legacy tengono in `image_url` un URL
  // intero, e chi legge deve accettarlo. Si usa com'è, come prima.
  it('un URL intero non viene firmato di nuovo', async () => {
    const legacy = 'https://ref.supabase.co/storage/v1/object/sign/food-images/u/vecchia.jpg?token=x'

    const { result } = mountCards([legacy])

    expect(result.current[0]).toMatchObject({ signedUrl: legacy, isLoading: false, error: null })
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(mocks.getSignedImageUrls).not.toHaveBeenCalled()
  })

  it('senza foto non chiede niente', async () => {
    const { result } = mountCards([null])

    expect(result.current[0]).toMatchObject({ signedUrl: null, isLoading: false, error: null })
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(mocks.getSignedImageUrls).not.toHaveBeenCalled()
  })

  describe('una foto scattata offline (`pending://`)', () => {
    const createObjectURL = vi.fn(() => 'blob:anteprima')
    const revokeObjectURL = vi.fn()

    beforeEach(() => {
      Object.assign(URL, { createObjectURL, revokeObjectURL })
      mocks.getPendingImage.mockResolvedValue({ buffer: new ArrayBuffer(4), type: 'image/jpeg' })
    })

    it('si serve da IndexedDB come blob, e non entra nel batch', async () => {
      const { result } = mountCards(['pending://abc', 'u/a.jpg'])

      await waitFor(() => expect(result.current.every((r) => r.signedUrl)).toBe(true))

      expect(result.current[0].signedUrl).toBe('blob:anteprima')
      expect(mocks.getPendingImage).toHaveBeenCalledWith('pending://abc')
      expect(mocks.getSignedImageUrls).toHaveBeenCalledWith(['u/a.jpg'], 3600)
    })

    it('il blob si revoca allo smontaggio', async () => {
      const { result, unmount } = mountCards(['pending://abc'])
      await waitFor(() => expect(result.current[0].signedUrl).toBe('blob:anteprima'))

      unmount()

      expect(revokeObjectURL).toHaveBeenCalledWith('blob:anteprima')
    })

    it('se IndexedDB non la trova è un errore, e si registra', async () => {
      mocks.getPendingImage.mockRejectedValue(new Error('non trovata'))

      const { result } = mountCards(['pending://abc'])

      await waitFor(() => expect(result.current[0].error).toBeTruthy())
      expect(mocks.logError).toHaveBeenCalledTimes(1)
    })
  })
})

describe('usePrefetchSignedUrls', () => {
  // Le card possono montare in più passate. La lista i percorsi li conosce già:
  // li mette in coda tutti insieme, e le card trovano la loro voce in volo.
  it('la lista mette in coda tutte le foto insieme, e le card che montano dopo non chiedono altro', async () => {
    const list = renderHook(
      () => usePrefetchSignedUrls(['u/a.jpg', 'u/b.jpg', null, 'pending://x', 'https://intero/y.jpg']),
      { wrapper }
    )
    const cards = mountCards(['u/a.jpg', 'u/b.jpg'])

    await waitFor(() => expect(cards.result.current.every((r) => r.signedUrl)).toBe(true))

    expect(mocks.getSignedImageUrls).toHaveBeenCalledTimes(1)
    expect(mocks.getSignedImageUrls).toHaveBeenCalledWith(['u/a.jpg', 'u/b.jpg'], 3600)
    list.unmount()
  })
})
