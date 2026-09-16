/**
 * `deleteFoodImage` non decide chi può cancellare: lo decide la policy.
 *
 * Le quattro policy su `storage.objects` (baseline `:401-456`) ammettono la
 * propria cartella **o quella di chi condivide una lista**. La guardia
 * `startsWith(userId)` che stava qui era più stretta: quando B sostituiva la
 * foto di un alimento condiviso caricata da A, sollevava prima di chiamare
 * Storage e l'oggetto di A restava orfano per sempre (#116).
 *
 * L'autorità è `entro-family/core/food-images.md`, sezione «L'oggetto non è
 * "dell'utente": è della lista». Il gemello su entro-mobile è
 * `src/shared/lib/foodImages.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRemove, mockStorageFrom } = vi.hoisted(() => {
  const mockRemove = vi.fn()
  return { mockRemove, mockStorageFrom: vi.fn(() => ({ remove: mockRemove })) }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: mockStorageFrom } },
}))
vi.mock('browser-image-compression', () => ({ default: vi.fn() }))
vi.mock('@/lib/safeLog', () => ({ logError: vi.fn(), redactUrl: (u: string) => u }))

import { deleteFoodImage } from '@/lib/storage'

beforeEach(() => {
  vi.clearAllMocks()
  mockRemove.mockResolvedValue({ data: [], error: null })
})

describe('deleteFoodImage — decide la policy di Storage', () => {
  it('cancella anche la foto caricata da un altro membro della lista', async () => {
    await expect(deleteFoodImage('utente-a/1-latte.jpg')).resolves.toBeUndefined()

    expect(mockStorageFrom).toHaveBeenCalledWith('food-images')
    expect(mockRemove).toHaveBeenCalledWith(['utente-a/1-latte.jpg'])
  })

  it('da una riga legacy cancella il percorso estratto dall’URL firmato', async () => {
    await deleteFoodImage(
      'https://ref.supabase.co/storage/v1/object/sign/food-images/utente-a/1-latte.jpg?token=eyJabc'
    )

    expect(mockRemove).toHaveBeenCalledWith(['utente-a/1-latte.jpg'])
  })

  it('se la policy rifiuta, l’errore arriva al chiamante', async () => {
    // Senza guardia la difesa è la RLS: il suo rifiuto non va inghiottito
    // qui, perché chi chiama deve poterlo loggare come oggetto orfano.
    mockRemove.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy' } })

    await expect(deleteFoodImage('estraneo/1-latte.jpg')).rejects.toThrow()
  })
})
