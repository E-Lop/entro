import { describe, expect, it } from 'vitest'
import {
  OBSOLETE_IMAGE_CACHES,
  SIGNED_IMAGE_CACHE,
  SIGNED_IMAGE_CACHEABLE_STATUSES,
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
