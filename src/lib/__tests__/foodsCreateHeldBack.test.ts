/**
 * `createFood` e la foto già caricata, quando la sessione è trattenuta (#229).
 *
 * Nella coda la foto si carica **prima** della riga (`mutationDefaults`), e da
 * lì `image_url` è un percorso d'archivio, non più `pending://`. Se poi
 * `createFood` trova la sessione assente per un errore di rete con un utente
 * dentro, la scrittura va in pausa e riparte con lo **stesso** percorso:
 * cancellare l'oggetto lì vorrebbe dire una riga che punta al nulla.
 * Segnalato da CodeRabbit sulla PR #238.
 */
import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAuth, mockFrom, mockDeleteFoodImage } = vi.hoisted(() => ({
  mockAuth: { getSession: vi.fn() },
  mockFrom: vi.fn(),
  mockDeleteFoodImage: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/supabase', () => ({ supabase: { auth: mockAuth, from: mockFrom } }))
vi.mock('@/lib/storage', () => ({ deleteFoodImage: mockDeleteFoodImage }))
vi.mock('@/lib/safeLog', () => ({ logError: vi.fn(), logWarn: vi.fn() }))

import { createFood } from '@/lib/foods'
import { isHeldBackRequest, releaseOnAuthEvent } from '@/lib/heldBackRequests'
import { declareSignedInCheck } from '@/lib/sessionBoundFetch'
import type { FoodInsert } from '@/lib/foods'

const UPLOADED = 'u1/1-foto.jpg'
const food = { name: 'Latte', image_url: UPLOADED } as unknown as FoodInsert

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  declareSignedInCheck(() => false)
  releaseOnAuthEvent('SIGNED_OUT')
  onlineManager.setOnline(true)
})

describe('createFood con la foto già caricata', () => {
  it('sessione trattenuta: la scrittura fallisce con quell’errore, e la foto resta', async () => {
    declareSignedInCheck(() => true)
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError('Failed to fetch', 0),
    })

    const { food: created, error } = await createFood(food, 'f1')

    expect(created).toBeNull()
    expect(isHeldBackRequest(error)).toBe(true)
    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('nessuno dentro: «Utente non autenticato», e la foto caricata si toglie come prima', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    const { error } = await createFood(food, 'f1')

    expect(error?.message).toBe('Utente non autenticato')
    expect(mockDeleteFoodImage).toHaveBeenCalledWith(UPLOADED)
  })
})
