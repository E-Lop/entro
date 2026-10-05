import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OBSOLETE_IMAGE_CACHES,
  SIGNED_IMAGE_CACHE,
  SIGNED_IMAGE_CACHEABLE_STATUSES,
  clearSignedImageCaches,
  isSignedImageUrl,
  signedImageCacheKey,
} from '../signedImageCache'

describe('la cache delle foto nel service worker (#211)', () => {
  it.each([
    'https://abcdefgh.supabase.co/storage/v1/object/sign/food-images/u/foto.jpg?token=abc',
    'http://127.0.0.1:54321/storage/v1/object/sign/food-images/u/foto.jpg?token=abc',
    'http://localhost:54321/storage/v1/object/sign/food-images/u/foto.jpg?token=abc',
  ])('prende le signed URL di Storage: %s', (href) => {
    expect(isSignedImageUrl(new URL(href))).toBe(true)
  })

  it.each([
    // Stesso host, ma non è una signed URL.
    'https://abcdefgh.supabase.co/rest/v1/foods?select=*',
    'https://abcdefgh.supabase.co/storage/v1/object/public/food-images/u/foto.jpg',
    'https://abcdefgh.supabase.co/storage/v1/object/sign',
    // Stesso percorso, ma non è Supabase.
    'https://example.com/storage/v1/object/sign/food-images/u/foto.jpg?token=abc',
    'https://supabase.co.example.com/storage/v1/object/sign/food-images/u/foto.jpg',
    'https://entroapp.it/',
  ])('lascia passare tutto il resto: %s', (href) => {
    expect(isSignedImageUrl(new URL(href))).toBe(false)
  })

  it('due signed URL della stessa foto hanno la stessa chiave', () => {
    const base = 'https://abcdefgh.supabase.co/storage/v1/object/sign/food-images/u/foto.jpg'
    expect(signedImageCacheKey(`${base}?token=primo`)).toBe(base)
    expect(signedImageCacheKey(`${base}?token=secondo`)).toBe(base)
  })

  it('due foto diverse hanno chiavi diverse', () => {
    const base = 'https://abcdefgh.supabase.co/storage/v1/object/sign/food-images/u'
    expect(signedImageCacheKey(`${base}/a.jpg?token=t`)).not.toBe(
      signedImageCacheKey(`${base}/b.jpg?token=t`)
    )
  })

  it('non tiene le risposte opache: lo stato 0 può essere un errore', () => {
    expect(SIGNED_IMAGE_CACHEABLE_STATUSES).toEqual([200])
  })

  it('la cache di prima è fra quelle da cancellare, e non è quella in uso', () => {
    expect(OBSOLETE_IMAGE_CACHES).toContain('supabase-images-cache')
    expect(OBSOLETE_IMAGE_CACHES).not.toContain(SIGNED_IMAGE_CACHE)
  })
})

describe('svuotare la cache delle foto quando il dispositivo perde l\'accesso (#213)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cancella la cache in uso e quelle di prima, e nessun\'altra', async () => {
    const deleted: string[] = []
    vi.stubGlobal('caches', {
      delete: async (name: string) => {
        deleted.push(name)
        return true
      },
    })

    await clearSignedImageCaches()

    expect(deleted.sort()).toEqual([SIGNED_IMAGE_CACHE, ...OBSOLETE_IMAGE_CACHES].sort())
    // I file dell'app e i font non sono di nessun utente: restano.
    expect(deleted.some((name) => name.includes('workbox') || name.includes('fonts'))).toBe(false)
  })

  it('dove la Cache API non c\'è non fa niente e non solleva', async () => {
    vi.stubGlobal('caches', undefined)

    await expect(clearSignedImageCaches()).resolves.toBeUndefined()
  })

  it('se una cancellazione fallisce prova lo stesso le altre, poi lo dice', async () => {
    const attempted: string[] = []
    vi.stubGlobal('caches', {
      delete: async (name: string) => {
        attempted.push(name)
        if (name === SIGNED_IMAGE_CACHE) throw new Error('Cache bloccata')
        return true
      },
    })

    await expect(clearSignedImageCaches()).rejects.toThrow('Cache bloccata')
    expect(attempted).toEqual(expect.arrayContaining(OBSOLETE_IMAGE_CACHES))
  })
})
