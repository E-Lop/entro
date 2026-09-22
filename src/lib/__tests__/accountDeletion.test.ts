/**
 * #145 — le foto degli alimenti che la cancellazione dell'account elimina.
 *
 * Il dialogo ricavava il percorso con `/food-images\/([^?]+)/`, che sul
 * percorso nudo del bucket privato non trova niente: le foto restavano nello
 * Storage. Qui si prova la raccolta dei percorsi in tutte le forme che
 * `image_url` ha avuto, e che un errore dello Storage fermi la cancellazione.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    foodsQuery: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ not: mocks.foodsQuery }) }),
    storage: { from: () => ({ remove: mocks.remove }) },
  },
}))

import { removePhotosOfDeletedFoods } from '@/lib/accountDeletion'

const rows = (...urls: string[]) => ({ data: urls.map((image_url) => ({ image_url })), error: null })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.remove.mockResolvedValue({ data: [], error: null })
})

describe('removePhotosOfDeletedFoods', () => {
  it('toglie la foto indicata dal percorso nudo, la forma del bucket privato', async () => {
    mocks.foodsQuery.mockResolvedValue(rows('u1/1-latte.jpg'))

    await removePhotosOfDeletedFoods()

    expect(mocks.remove).toHaveBeenCalledWith(['u1/1-latte.jpg'])
  })

  it('dall’URL firmato storico ricava il percorso senza query string', async () => {
    mocks.foodsQuery.mockResolvedValue(
      rows('http://x/storage/v1/object/sign/food-images/u1/2-pane.jpg?token=abc')
    )

    await removePhotosOfDeletedFoods()

    expect(mocks.remove).toHaveBeenCalledWith(['u1/2-pane.jpg'])
  })

  it('salta le foto in attesa di caricamento e gli URL che non sono del bucket', async () => {
    mocks.foodsQuery.mockResolvedValue(
      rows('pending://abc', 'https://images.openfoodfacts.org/x.jpg', 'u1/3-uova.jpg')
    )

    await removePhotosOfDeletedFoods()

    expect(mocks.remove).toHaveBeenCalledWith(['u1/3-uova.jpg'])
  })

  it('una foto usata da due alimenti si chiede una volta sola', async () => {
    mocks.foodsQuery.mockResolvedValue(rows('u1/4-mela.jpg', 'u1/4-mela.jpg'))

    await removePhotosOfDeletedFoods()

    expect(mocks.remove).toHaveBeenCalledWith(['u1/4-mela.jpg'])
  })

  it('senza foto non chiama lo Storage', async () => {
    mocks.foodsQuery.mockResolvedValue(rows())

    await removePhotosOfDeletedFoods()

    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('se lo Storage rifiuta, lancia: la cancellazione dell’account non deve proseguire', async () => {
    mocks.foodsQuery.mockResolvedValue(rows('u1/1-latte.jpg'))
    mocks.remove.mockResolvedValue({ data: null, error: { message: 'down' } })

    await expect(removePhotosOfDeletedFoods()).rejects.toThrow(/foto/)
  })

  it('se non si riesce a leggere quali foto togliere, lancia invece di proseguire senza', async () => {
    mocks.foodsQuery.mockResolvedValue({ data: null, error: { message: 'timeout' } })

    await expect(removePhotosOfDeletedFoods()).rejects.toThrow(/foto/)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('il messaggio d’errore non contiene percorsi', async () => {
    mocks.foodsQuery.mockResolvedValue(rows('u1/1-latte.jpg'))
    mocks.remove.mockResolvedValue({ data: null, error: { message: 'u1/1-latte.jpg not allowed' } })

    await expect(removePhotosOfDeletedFoods()).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('u1/') })
    )
  })
})
