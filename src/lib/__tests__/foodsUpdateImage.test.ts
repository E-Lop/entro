/**
 * `updateFood` e la foto: l'ordine fra l'oggetto e la riga.
 *
 * Il criterio viene da `entro-family/core/food-images.md`: **si scrive nella
 * direzione che, fallendo a metà, lascia spazzatura**. Un oggetto orfano si
 * recupera; una riga che punta al nulla l'utente la vede.
 *
 * Prima di #116 la vecchia foto si cancellava **prima** dell'UPDATE: se la
 * scrittura falliva, la foto era persa e la riga puntava a un oggetto che non
 * c'era più.
 *
 * Il client è finto e ogni chiamata si iscrive in un unico registro, perché è
 * l'ordine la cosa da provare: due mock separati direbbero *che* sono stati
 * chiamati, non *prima di chi*.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAuth, mockFrom, mockBuilder, mockDeleteFoodImage, calls } = vi.hoisted(() => {
  const calls: string[] = []
  const mockBuilder = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn((data: Record<string, unknown>) => {
      calls.push(`update ${String(data.image_url)}`)
      return mockBuilder
    }),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }
  return {
    calls,
    mockAuth: { getSession: vi.fn() },
    mockFrom: vi.fn(() => mockBuilder),
    mockBuilder,
    mockDeleteFoodImage: vi.fn((path: string) => {
      calls.push(`remove ${path}`)
      return Promise.resolve()
    }),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockAuth, from: mockFrom },
}))
vi.mock('@/lib/storage', () => ({ deleteFoodImage: mockDeleteFoodImage }))
vi.mock('@/lib/pendingImages', () => ({
  isPendingUrl: (url: unknown) => typeof url === 'string' && url.startsWith('pending://'),
  deletePendingImage: vi.fn(),
}))
vi.mock('@/lib/safeLog', () => ({ logError: vi.fn(), logWarn: vi.fn() }))

import { updateFood } from '@/lib/foods'

const FOOD_ID = 'food-1'
const OLD = 'utente-a/1-vecchia.jpg'
const NEW = 'utente-b/2-nuova.jpg'

/** La riga di oggi, poi l'esito dell'UPDATE. */
function rowThenUpdate(imageUrl: string | null, update: 'ok' | 'error' = 'ok') {
  mockBuilder.single
    .mockReset()
    .mockResolvedValueOnce({ data: { image_url: imageUrl }, error: null })
    .mockResolvedValue(
      update === 'ok'
        ? { data: { id: FOOD_ID }, error: null }
        : { data: null, error: { message: 'permission denied for table foods' } }
    )
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  mockAuth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'utente-b' } } },
    error: null,
  })
})

describe('updateFood — sostituire la foto', () => {
  it('UPDATE col nuovo percorso, **poi** cancellazione del vecchio', async () => {
    rowThenUpdate(OLD)

    const { error } = await updateFood(FOOD_ID, { image_url: NEW })

    expect(error).toBeNull()
    expect(calls).toEqual([`update ${NEW}`, `remove ${OLD}`])
  })

  it('se l’UPDATE fallisce il vecchio resta, e il nuovo appena caricato si cancella', async () => {
    // La riga cita ancora il vecchio; il nuovo non lo cita nessuno.
    rowThenUpdate(OLD, 'error')

    const { error } = await updateFood(FOOD_ID, { image_url: NEW })

    expect(error).toBeInstanceOf(Error)
    expect(calls).toEqual([`update ${NEW}`, `remove ${NEW}`])
  })

  it('se la cancellazione del vecchio fallisce, la modifica è salva lo stesso', async () => {
    rowThenUpdate(OLD)
    mockDeleteFoodImage.mockRejectedValueOnce(new Error('Storage irraggiungibile'))

    const { food, error } = await updateFood(FOOD_ID, { image_url: NEW })

    expect(error).toBeNull()
    expect(food).not.toBeNull()
  })
})

describe('updateFood — togliere la foto', () => {
  it('UPDATE con `image_url: null`, **poi** cancellazione', async () => {
    rowThenUpdate(OLD)

    await updateFood(FOOD_ID, { image_url: null })

    expect(calls).toEqual(['update null', `remove ${OLD}`])
  })

  it('se l’UPDATE fallisce l’oggetto resta, perché la riga lo cita ancora', async () => {
    rowThenUpdate(OLD, 'error')

    await updateFood(FOOD_ID, { image_url: null })

    expect(calls).toEqual(['update null'])
  })
})

describe('updateFood — la foto non cambia', () => {
  it('stesso percorso: Storage non si tocca', async () => {
    rowThenUpdate(OLD)

    await updateFood(FOOD_ID, { image_url: OLD })

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
  })

  it('stesso percorso e UPDATE fallita: la foto di prima non si cancella', async () => {
    // Il «nuovo» qui è il vecchio: cancellarlo per compensare lascerebbe la
    // riga puntata al nulla, cioè esattamente il difetto da evitare.
    rowThenUpdate(OLD, 'error')

    await updateFood(FOOD_ID, { image_url: OLD })

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
  })

  it('`image_url: undefined` non tocca la foto: sul filo la chiave non esiste', async () => {
    // `JSON.stringify` butta le chiavi `undefined`, quindi l'UPDATE lascia la
    // riga col riferimento di prima. Cancellare l'oggetto la lascerebbe
    // puntata al nulla.
    rowThenUpdate(OLD)

    await updateFood(FOOD_ID, { name: 'Latte', image_url: undefined })

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
  })

  it('senza `image_url` nel payload non legge nemmeno la riga', async () => {
    mockBuilder.single.mockReset().mockResolvedValue({ data: { id: FOOD_ID }, error: null })

    await updateFood(FOOD_ID, { name: 'Latte' })

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
    expect(mockBuilder.single).toHaveBeenCalledTimes(1)
  })

  it('se la lettura della riga fallisce non cancella niente, nemmeno dopo l’UPDATE', async () => {
    // Senza sapere cosa citava la riga non si può sapere cosa è spazzatura.
    mockBuilder.single
      .mockReset()
      .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
      .mockResolvedValue({ data: null, error: { message: 'timeout' } })

    await updateFood(FOOD_ID, { image_url: NEW })

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
  })

  it('un riferimento `pending://` non si passa a Storage per compensare', async () => {
    // Non è mai salito: vive in IndexedDB, e lo risolve la coda offline.
    rowThenUpdate(OLD, 'error')

    await updateFood(FOOD_ID, { image_url: 'pending://abc' })

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
  })
})
