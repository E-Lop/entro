/**
 * Togliere un alimento dalla lista senza distruggere il dato che serve a
 * capire com'è finito.
 *
 * Prima l'eliminazione era una DELETE vera: la riga spariva insieme all'esito,
 * quindi registrare «l'ho consumato» e poi eliminare avrebbe scritto un dato e
 * subito dopo l'avrebbe buttato. Ora è una sola UPDATE che imposta
 * `deleted_at`, azzera `image_url` e registra l'esito — atomica, e offline una
 * sola voce in coda invece di due che si possono separare.
 *
 * L'immagine invece viene cancellata davvero: è un blob pesante e non serve a
 * nessuna metrica.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAuth, mockFrom, mockBuilder, mockDeleteFoodImage, mockDeletePendingImage } =
  vi.hoisted(() => {
    const mockBuilder = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }
    return {
      mockAuth: { getSession: vi.fn() },
      mockFrom: vi.fn(() => mockBuilder),
      mockBuilder,
      mockDeleteFoodImage: vi.fn(),
      mockDeletePendingImage: vi.fn(),
    }
  })

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockAuth, from: mockFrom },
}))

vi.mock('@/lib/storage', () => ({
  deleteFoodImage: mockDeleteFoodImage,
}))

vi.mock('@/lib/pendingImages', () => ({
  isPendingUrl: (url: unknown) => typeof url === 'string' && url.startsWith('pending://'),
  deletePendingImage: mockDeletePendingImage,
}))

import { softDeleteFood } from '@/lib/foods'

const USER_ID = 'user-1'
const FOOD_ID = 'food-1'

/** L'UPDATE finale, cioè l'unica scrittura che questa funzione fa. */
function updatePayload(): Record<string, unknown> {
  return mockBuilder.update.mock.calls[0][0]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.getSession.mockResolvedValue({
    data: { session: { user: { id: USER_ID } } },
    error: null,
  })
  // Prima chiamata: la lettura di image_url. Seconda: l'UPDATE.
  mockBuilder.single
    .mockResolvedValueOnce({ data: { image_url: null }, error: null })
    .mockResolvedValue({ data: { id: FOOD_ID }, error: null })
  mockDeleteFoodImage.mockResolvedValue(undefined)
  mockDeletePendingImage.mockResolvedValue(undefined)
})

describe('softDeleteFood — la riga sopravvive', () => {
  it('imposta deleted_at invece di distruggere la riga', async () => {
    const { error } = await softDeleteFood(FOOD_ID)

    expect(error).toBeNull()
    expect(updatePayload().deleted_at).toEqual(expect.any(String))
    // Nessuna DELETE: è il punto di tutta la modifica.
    expect(mockBuilder).not.toHaveProperty('delete')
  })

  it('senza esito non scrive nessuno status', async () => {
    // «Toglilo e basta» è l'errore di inserimento: sporcare la metrica
    // anti-spreco con gli errori la rende inutile quanto lasciarla vuota.
    await softDeleteFood(FOOD_ID)

    expect(updatePayload()).not.toHaveProperty('status')
    expect(updatePayload()).not.toHaveProperty('consumed_at')
  })

  it('registra «consumato» con il momento in cui è successo', async () => {
    await softDeleteFood(FOOD_ID, 'consumed')

    expect(updatePayload().status).toBe('consumed')
    expect(updatePayload().consumed_at).toEqual(expect.any(String))
  })

  it('registra «buttato» senza consumed_at, che non avrebbe senso', async () => {
    await softDeleteFood(FOOD_ID, 'wasted')

    expect(updatePayload().status).toBe('wasted')
    expect(updatePayload()).not.toHaveProperty('consumed_at')
  })

  it('esito e rimozione stanno nella stessa UPDATE', async () => {
    // Una scrittura sola: non c'è un ordine da scegliere, né uno stato
    // intermedio in cui l'esito è registrato ma l'alimento è ancora in lista.
    await softDeleteFood(FOOD_ID, 'consumed')

    expect(mockBuilder.update).toHaveBeenCalledTimes(1)
    expect(updatePayload()).toMatchObject({
      status: 'consumed',
      deleted_at: expect.any(String),
    })
  })
})

describe('softDeleteFood — l\'immagine invece sparisce davvero', () => {
  it('cancella il blob su Storage e azzera image_url', async () => {
    mockBuilder.single
      .mockReset()
      .mockResolvedValueOnce({ data: { image_url: `${USER_ID}/foto.jpg` }, error: null })
      .mockResolvedValue({ data: { id: FOOD_ID }, error: null })

    await softDeleteFood(FOOD_ID)

    expect(mockDeleteFoodImage).toHaveBeenCalledWith(`${USER_ID}/foto.jpg`, USER_ID)
    // Azzerare il riferimento è parte del contratto: un puntatore a un blob
    // che non c'è più è peggio di nessun puntatore.
    expect(updatePayload().image_url).toBeNull()
  })

  it('per un\'immagine ancora in coda la toglie da IndexedDB, non da Storage', async () => {
    mockBuilder.single
      .mockReset()
      .mockResolvedValueOnce({ data: { image_url: 'pending://abc-123' }, error: null })
      .mockResolvedValue({ data: { id: FOOD_ID }, error: null })

    await softDeleteFood(FOOD_ID)

    expect(mockDeletePendingImage).toHaveBeenCalledWith('pending://abc-123')
    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
    expect(updatePayload().image_url).toBeNull()
  })

  it('se la cancellazione dell\'immagine fallisce, l\'alimento esce comunque dalla lista', async () => {
    // L'utente ha chiesto di togliere l'alimento: un blob rimasto indietro è
    // un problema di spazio, non un motivo per disobbedire.
    mockBuilder.single
      .mockReset()
      .mockResolvedValueOnce({ data: { image_url: `${USER_ID}/foto.jpg` }, error: null })
      .mockResolvedValue({ data: { id: FOOD_ID }, error: null })
    mockDeleteFoodImage.mockRejectedValue(new Error('Storage irraggiungibile'))

    const { error } = await softDeleteFood(FOOD_ID)

    expect(error).toBeNull()
    expect(updatePayload().deleted_at).toEqual(expect.any(String))
  })

  it('senza immagine non tocca lo Storage', async () => {
    await softDeleteFood(FOOD_ID)

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
    expect(mockDeletePendingImage).not.toHaveBeenCalled()
  })
})

describe('softDeleteFood — errori', () => {
  it('senza sessione non scrive niente', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    const { error } = await softDeleteFood(FOOD_ID)

    expect(error?.message).toBe('Utente non autenticato')
    expect(mockBuilder.update).not.toHaveBeenCalled()
  })

  it('riporta l\'errore dell\'UPDATE invece di sollevare', async () => {
    mockBuilder.single
      .mockReset()
      .mockResolvedValueOnce({ data: { image_url: null }, error: null })
      .mockResolvedValue({ data: null, error: { message: 'permission denied for table foods' } })

    const { error } = await softDeleteFood(FOOD_ID)

    expect(error?.message).toBe('permission denied for table foods')
  })
})
