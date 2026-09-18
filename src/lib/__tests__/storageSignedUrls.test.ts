/**
 * `getSignedImageUrls` firma più foto in **una** richiesta (#119).
 *
 * Prima firmava un percorso alla volta, in parallelo: N percorsi, N richieste.
 * `createSignedUrls` risponde 200 anche quando un oggetto manca, con
 * `signedURL: null` e un `error` per voce — misurato sulla Supabase locale il
 * 18 set 2026, e il testo è lo stesso per «non esiste» e «non hai accesso».
 * Per questo una voce senza URL vale «nessuna foto» e non si riconosce dal
 * testo. Il gemello su entro-mobile è `getSignedImageUrls` in
 * `src/shared/lib/foodImages.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateSignedUrls, mockStorageFrom, mockLogError } = vi.hoisted(() => {
  const mockCreateSignedUrls = vi.fn()
  return {
    mockCreateSignedUrls,
    mockStorageFrom: vi.fn(() => ({ createSignedUrls: mockCreateSignedUrls })),
    mockLogError: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: mockStorageFrom } } }))
vi.mock('browser-image-compression', () => ({ default: vi.fn() }))
vi.mock('@/lib/safeLog', () => ({ logError: mockLogError, redactUrl: (u: string) => u }))

import { getSignedImageUrls } from '@/lib/storage'

const signed = (path: string) => ({
  path,
  signedUrl: `https://ref.supabase.co/storage/v1/object/sign/food-images/${path}?token=eyJabc`,
  error: null,
})
const missing = (path: string) => ({
  path,
  signedUrl: null,
  error: 'Either the object does not exist or you do not have access to it',
})

beforeEach(() => vi.clearAllMocks())

describe('getSignedImageUrls', () => {
  it('firma tutti i percorsi in una chiamata sola, con la scadenza chiesta', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: [signed('u/a.jpg'), signed('u/b.jpg')], error: null })

    const urls = await getSignedImageUrls(['u/a.jpg', 'u/b.jpg'], 86400)

    expect(mockStorageFrom).toHaveBeenCalledWith('food-images')
    expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1)
    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['u/a.jpg', 'u/b.jpg'], 86400)
    expect([...urls.keys()]).toEqual(['u/a.jpg', 'u/b.jpg'])
    expect(urls.get('u/a.jpg')).toContain('/u/a.jpg?token=')
  })

  it('senza scadenza usa un’ora', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: [signed('u/a.jpg')], error: null })

    await getSignedImageUrls(['u/a.jpg'])

    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['u/a.jpg'], 3600)
  })

  it('un oggetto che manca resta fuori dalla mappa, senza far fallire gli altri né finire nei log', async () => {
    mockCreateSignedUrls.mockResolvedValue({
      data: [signed('u/a.jpg'), missing('u/sparita.jpg')],
      error: null,
    })

    const urls = await getSignedImageUrls(['u/a.jpg', 'u/sparita.jpg'])

    expect([...urls.keys()]).toEqual(['u/a.jpg'])
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('lo stesso percorso chiesto due volte si firma una volta', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: [signed('u/a.jpg')], error: null })

    await getSignedImageUrls(['u/a.jpg', 'u/a.jpg'])

    expect(mockCreateSignedUrls).toHaveBeenCalledWith(['u/a.jpg'], 3600)
  })

  it('senza percorsi non chiama Storage', async () => {
    const urls = await getSignedImageUrls([])

    expect(urls.size).toBe(0)
    expect(mockCreateSignedUrls).not.toHaveBeenCalled()
  })

  it('se fallisce la chiamata intera lancia un errore italiano, e nei log non va nessun token', async () => {
    mockCreateSignedUrls.mockResolvedValue({ data: null, error: { message: 'Bad Gateway' } })

    await expect(getSignedImageUrls(['u/a.jpg'])).rejects.toThrow(
      'Errore durante il recupero delle immagini'
    )
    expect(mockLogError).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mockLogError.mock.calls)).not.toContain('token=')
  })
})
